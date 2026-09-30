import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { useAuth } from '../state/AuthContext';
import { useSubscription } from '../state/SubscriptionContext';
import { useAsk } from '../state/AskDialogContext';
import { useGo } from '../navigation/useGo';
import Press from '../components/atoms/Press';
import * as paymentApi from '../lib/paymentApi';

function buildCheckoutHtml(d) {
  return `
    <!DOCTYPE html>
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body onload="document.forms['payuForm'].submit()">
        <form name="payuForm" action="${d.payuUrl}" method="POST">
          <input type="hidden" name="key" value="${d.key}" />
          <input type="hidden" name="txnid" value="${d.txnid}" />
          <input type="hidden" name="amount" value="${d.amount}" />
          <input type="hidden" name="productinfo" value="${d.productinfo}" />
          <input type="hidden" name="firstname" value="${d.firstname}" />
          <input type="hidden" name="email" value="${d.email}" />
          <input type="hidden" name="phone" value="${d.phone}" />
          <input type="hidden" name="surl" value="${d.surl}" />
          <input type="hidden" name="furl" value="${d.furl}" />
          <input type="hidden" name="hash" value="${d.hash}" />
          <input type="hidden" name="udf1" value="${d.udf1}" />
          <input type="hidden" name="udf2" value="${d.udf2}" />
          <input type="hidden" name="udf3" value="${d.udf3}" />
          <input type="hidden" name="udf4" value="${d.udf4 || ''}" />
          <input type="hidden" name="udf5" value="${d.udf5 || ''}" />
          <input type="hidden" name="service_provider" value="payu_paisa" />
        </form>
      </body>
    </html>
  `;
}

/* Android's UPI-app deep links (GPay/PhonePe/Paytm) arrive as
   intent:// URLs a WebView/Linking can't open directly — rewrite to
   the plain upi:// scheme so the OS can resolve an installed app. */
function toLinkableUrl(url) {
  if (!url.startsWith('intent://')) return url;
  const schemeMatch = url.match(/scheme=([^;]+)/);
  const scheme = schemeMatch ? schemeMatch[1] : 'upi';
  let linkable = url.replace('intent://', `${scheme}://`);
  const hashIndex = linkable.indexOf('#Intent;');
  if (hashIndex !== -1) linkable = linkable.substring(0, hashIndex);
  return linkable;
}

/* Full screen, edge to edge: the app's header and tab bar are hidden
   here (RootNavigator), so this screen pads for the status bar and the
   system navigation bar itself — otherwise PayU's own buttons (Pay,
   and "cancel payment? yes/no") land underneath them.

   Tab screens stay mounted between visits, so every visit carries a
   fresh `startedAt` and all state resets on it — a second checkout
   must never reuse the first one's transaction or "already finished"
   flag. */
export default function CheckoutScreen({ route }) {
  const { plan, startedAt } = route.params || {};
  const { token } = useAuth();
  const { refresh } = useSubscription();
  const ask = useAsk();
  const go = useGo();
  const insets = useSafeAreaInsets();
  const [html, setHtml] = useState(null);
  const [error, setError] = useState('');
  const settledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    settledRef.current = false;
    setHtml(null);
    setError('');
    if (!plan) return undefined;
    (async () => {
      try {
        const res = await paymentApi.initiateCheckout({ plan }, token);
        if (!cancelled) setHtml(buildCheckoutHtml(res));
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, startedAt, token]);

  const finish = useCallback(
    async outcome => {
      if (settledRef.current) return;
      settledRef.current = true;
      setHtml(null);
      // the server has already applied (or refused) the payment — this only picks up the result.
      // Refreshed on failure too: a callback that raced the WebView may still have gone through.
      await refresh();
      go(outcome === 'SUCCESS' ? 'subscription' : 'premium');
    },
    [refresh, go],
  );

  // leaving mid-payment: confirm, then check with the server in case it went through anyway
  const leave = useCallback(async () => {
    if (!html) {
      go('premium');
      return;
    }
    const ok = await ask({
      title: 'Leave this payment?',
      body: "If you've already paid, your plan will still be applied — use Restore purchases on the Subscription screen if it doesn't show up.",
      confirmLabel: 'Leave',
      cancelLabel: 'Stay',
    });
    if (ok) finish('FAILURE');
  }, [html, ask, go, finish]);

  // Android back button goes through the same confirmation instead of silently dropping the payment
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        leave();
        return true;
      });
      return () => sub.remove();
    }, [leave]),
  );

  const handleMessage = event => finish(event.nativeEvent.data);

  const handleShouldStartLoad = request => {
    const { url } = request;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (url.includes('payu-success')) setTimeout(() => finish('SUCCESS'), 1500);
      else if (url.includes('payu-failure')) setTimeout(() => finish('FAILURE'), 1500);
      return true;
    }
    Linking.openURL(toLinkableUrl(url)).catch(() => {});
    return false;
  };

  let body;
  if (error) {
    body = (
      <View style={styles.centerWrap}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  } else if (!html) {
    body = (
      <View style={styles.centerWrap}>
        <ActivityIndicator color={C.brand} />
        <Text style={styles.loadingText}>Preparing checkout…</Text>
      </View>
    );
  } else {
    body = <WebView source={{ html }} onMessage={handleMessage} onShouldStartLoadWithRequest={handleShouldStartLoad} style={styles.web} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Press onPress={leave} style={styles.closeBtn} accessibilityLabel="Leave payment">
          <Text style={styles.closeLabel}>✕</Text>
        </Press>
        <Text style={styles.title}>Secure payment</Text>
        <View style={styles.closeBtn} />
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cardSolid },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  title: { fontFamily: SANS.semibold, fontSize: 16, color: C.ink },
  closeBtn: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  closeLabel: { color: C.ink, fontSize: 17 },
  web: { flex: 1 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, marginTop: 12 },
  errorText: { fontFamily: SANS.regular, fontSize: 15, color: C.stage2, textAlign: 'center', lineHeight: 22 },
});
