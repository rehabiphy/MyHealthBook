import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SANS } from '../theme/typography';
import { prettyTime, refillLabel, slotOf, useReminders } from '../lib/meds';
import { useData } from '../state/DataContext';
import Mono from '../components/atoms/Mono';
import Press from '../components/atoms/Press';
import Rise from '../components/atoms/Rise';

/* Follows you across tabs, just above the tab bar (`bottom` comes from
   RootNavigator). A dose that's due outranks a refill warning. */
export default function DoseBanner({ data, go, bottom }) {
  const { toggleDoseTaken } = useData();
  const { doses, refills } = useReminders(data);
  const [hidden, setHidden] = useState([]);
  const d = doses[0];
  const refill = refills.find(r => !hidden.includes(r.med.id));

  if (!d && !refill) return null;

  const take = async () => {
    try {
      await toggleDoseTaken(d.id);
    } catch {
      // silent — MedsScreen's own toggle surfaces errors; this is a quick-action shortcut
    }
  };

  if (d) {
    return (
      <Rise style={[styles.wrap, bottom != null && { bottom }]}>
        <LinearGradient colors={['#4ADE80', '#16A34A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shell}>
          <Press onPress={() => go('meds')} style={{ flex: 1, minWidth: 0 }}>
            <Mono style={styles.captionOnBanner}>
              {slotOf(d.slot).label} · {prettyTime(d.time)}
              {doses.length > 1 ? ` · +${doses.length - 1} more` : ''}
            </Mono>
            <Text style={styles.title} numberOfLines={1}>
              {d.med.name}
              {d.med.dose ? ` · ${d.med.dose}` : ''}
            </Text>
          </Press>
          <Press onPress={take} style={styles.actionBtn}>
            <Text style={styles.actionLabel}>Taken</Text>
          </Press>
        </LinearGradient>
      </Rise>
    );
  }

  return (
    <Rise style={[styles.wrap, bottom != null && { bottom }]}>
      <LinearGradient colors={['#4ADE80', '#16A34A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shell}>
        <Press onPress={() => go('meds')} style={{ flex: 1, minWidth: 0 }}>
          <Mono style={styles.captionOnBanner}>
            Refill · {refillLabel(refill.days).toLowerCase()}
            {refills.length > 1 ? ` · +${refills.length - 1} more` : ''}
          </Mono>
          <Text style={styles.title} numberOfLines={1}>
            {refill.med.name}
          </Text>
        </Press>
        <Press onPress={() => setHidden(h => [...h, refill.med.id])} style={styles.actionBtn}>
          <Text style={styles.actionLabel}>Got it</Text>
        </Press>
      </LinearGradient>
    </Rise>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 78,
    left: 12,
    right: 12,
    zIndex: 45,
  },
  shell: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 30,
    elevation: 8,
  },
  captionOnBanner: { color: 'rgba(255,255,255,0.9)' },
  title: { fontFamily: SANS.semibold, fontSize: 15.5, letterSpacing: -0.3, marginTop: 3, color: '#FFFFFF' },
  actionBtn: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 16,
    flexShrink: 0,
  },
  actionLabel: { fontFamily: SANS.semibold, fontSize: 14, color: '#166534' },
});
