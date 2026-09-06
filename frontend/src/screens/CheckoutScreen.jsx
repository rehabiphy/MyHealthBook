import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { useAuth } from '../state/AuthContext';
import { useGo } from '../navigation/useGo';
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

export default function CheckoutScreen({ route }) {
  const { plan } = route.params || {};
  const { token, refreshUser } = useAuth();
  const go = useGo();
  const [html, setHtml] = useState(null);
  const [error, setError] = useState('');
  const settledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
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
  }, [plan, token]);

  const finish = async outcome => {
    if (settledRef.current) return;
    settledRef.current = true;
    if (outcome === 'SUCCESS') {
      try {
        await refreshUser();
      } catch {
        // the payment itself already succeeded server-side — a failed
        // refresh just means the app shows stale status until next reload
      }
    }
    go('premium');
  };

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

  if (error) {
    return (
      <View style={styles.centerWrap}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!html) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator color={C.brand} />
        <Text style={styles.loadingText}>Preparing checkout…</Text>
      </View>
    );
  }

  return <WebView source={{ html }} onMessage={handleMessage} onShouldStartLoadWithRequest={handleShouldStartLoad} style={{ flex: 1 }} />;
}

const styles = StyleSheet.create({
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, marginTop: 12 },
  errorText: { fontFamily: SANS.regular, fontSize: 15, color: C.stage2, textAlign: 'center', lineHeight: 22 },
});
