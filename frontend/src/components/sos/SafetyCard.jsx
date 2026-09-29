import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { C } from '../../theme/colors';
import { SANS } from '../../theme/typography';
import { useAsk } from '../../state/AskDialogContext';
import { requestNotificationPermission } from '../../lib/notifications';
import {
  getSosStatus,
  openAppSettings,
  openBatterySettings,
  openFullScreenSettings,
  requestSosLocation,
  setFallDetection,
  simulateFall,
  sosSupported,
  testAlarm,
} from '../../lib/sosNative';
import Card from '../atoms/Card';
import Mono from '../atoms/Mono';
import Btn from '../atoms/Btn';
import Seg from '../atoms/Seg';

/* Profile → Safety: the fall-detection switch, the phone settings it
   depends on, and ways to try it without dropping the phone. */
export default function SafetyCard() {
  const ask = useAsk();
  const [status, setStatus] = useState(null);
  const [note, setNote] = useState('');

  /* The service starts asynchronously (after a toggle, or on app launch
     after a reboot) — if it's on but not up yet, look once more before
     showing the "isn't running" warning as real. */
  const load = useCallback(async (retry = true) => {
    try {
      const s = await getSosStatus();
      setStatus(s);
      if (retry && s.fallEnabled && !s.fallRunning) setTimeout(() => load(false), 2000);
    } catch {
      // status is advisory — leave the last one showing
    }
  }, []);

  // coming back from a settings screen is the usual reason things changed
  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', s => s === 'active' && load());
    return () => sub.remove();
  }, [load]);

  if (!sosSupported) return null;

  const on = !!status?.fallEnabled;

  const toggle = async value => {
    if ((value === 'on') === on) return;
    if (value === 'on') {
      const ok = await ask({
        title: 'Turn on fall detection?',
        body: "If this phone drops and stays still, everyone in your family circle gets an SOS that rings their phone for 30 seconds. You can cancel it from the notification. A small notification stays on while it's watching.",
        confirmLabel: 'Turn on',
        cancelLabel: 'Not now',
      });
      if (!ok) return;
      await requestNotificationPermission();
      if (!status?.locationAlways) await askLocation();
    }
    try {
      await setFallDetection(value === 'on');
      setNote('');
    } catch (err) {
      setNote(err.message);
    }
    load();
  };

  /* Explains first — Android's own "Allow all the time" screen says
     nothing about why. Optional: the SOS still goes out without it. */
  const askLocation = async () => {
    const ok = await ask({
      title: 'Share your location in an SOS?',
      body: 'Your family gets a Google Maps link to where your phone is. A fall usually happens with the app closed, so choose "Allow all the time" on the next screen.',
      confirmLabel: 'Continue',
      cancelLabel: 'Skip',
    });
    if (!ok) return;
    try {
      if ((await requestSosLocation()) === 'blocked') openAppSettings();
    } catch {
      // the request itself failed — the check below offers settings
    }
    load();
  };

  const simulate = async () => {
    const ok = await ask({
      title: 'Send a real SOS?',
      body: "This alerts your family exactly as a fall would, and their phones will ring. Tell them it's a test, or cancel it straight away.",
      confirmLabel: 'Send SOS',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (ok) simulateFall();
  };

  return (
    <Card style={{ marginTop: 10 }}>
      <Mono>Safety · Fall detection</Mono>
      <Text style={styles.hint}>When this phone falls and lies still, your family circle gets an SOS. You have 30 seconds to cancel it if you're OK.</Text>
      <View style={{ marginTop: 14 }}>
        <Seg
          value={on ? 'on' : 'off'}
          onChange={toggle}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
          ]}
        />
      </View>
      {note ? <Text style={[styles.hint, { color: C.stage2 }]}>{note}</Text> : null}

      {on && status && !status.fallRunning && (
        <Text style={[styles.hint, { color: C.stage2 }]}>Fall detection isn't running. Turn it off and on again, or check the app's permissions.</Text>
      )}

      {on && status && !status.batteryUnrestricted && (
        <View style={styles.check}>
          <Text style={styles.checkText}>Your phone may stop fall detection to save battery. Set MyHealthBook to "Don't optimise" / "Unrestricted".</Text>
          <Btn kind="quiet" style={styles.checkBtn} onClick={openBatterySettings}>
            Battery settings
          </Btn>
        </View>
      )}

      {on && status && !status.locationAlways && (
        <View style={styles.check}>
          <Text style={styles.checkText}>
            {status.locationAllowed
              ? 'Set location to "Allow all the time" so your SOS includes where you are, even with the app closed.'
              : "Your SOS won't include your location. Allow location so your family gets a Google Maps link to where you are."}
          </Text>
          {/* once asked, Android only lets "all the time" be set from the app's settings */}
          <Btn kind="quiet" style={styles.checkBtn} onClick={status.locationAllowed ? openAppSettings : askLocation}>
            {status.locationAllowed ? 'Location settings' : 'Allow location'}
          </Btn>
        </View>
      )}

      {status && !status.fullScreenAllowed && (
        <View style={styles.check}>
          <Text style={styles.checkText}>Allow full-screen alerts so a family SOS shows over your lock screen.</Text>
          <Btn kind="quiet" style={styles.checkBtn} onClick={openFullScreenSettings}>
            Allow full-screen alerts
          </Btn>
        </View>
      )}

      {on && (
        <Text style={styles.hint}>
          On Realme, Oppo, Vivo and Xiaomi phones, also turn on Auto-launch / Autostart for MyHealthBook, or the phone may stop it in the background.{' '}
          <Text style={styles.link} onPress={openAppSettings}>
            App settings
          </Text>
        </Text>
      )}

      <Btn kind="quiet" style={{ marginTop: 16 }} onClick={testAlarm}>
        Test the alarm on this phone
      </Btn>
      <Btn kind="quiet" style={{ marginTop: 8 }} textStyle={{ color: C.stage2 }} onClick={simulate}>
        Simulate a fall (sends a real SOS)
      </Btn>
    </Card>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink3, lineHeight: 21, marginTop: 12 },
  check: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.hair },
  checkText: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, lineHeight: 21 },
  checkBtn: { marginTop: 10, paddingVertical: 12 },
  link: { fontFamily: SANS.semibold, color: C.brand2 },
});
