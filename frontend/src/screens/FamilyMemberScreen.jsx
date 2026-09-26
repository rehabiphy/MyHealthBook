import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { DataProvider, useData } from '../state/DataContext';
import { useGo } from '../navigation/useGo';
import { FAMILY_SCOPES } from '../lib/familyApi';
import Mono from '../components/atoms/Mono';
import Seg from '../components/atoms/Seg';
import Press from '../components/atoms/Press';
import LogScreen from './LogScreen';
import MedsScreen from './MedsScreen';
import HistoryScreen from './HistoryScreen';
import HealthScreen from './HealthScreen';

const SECTION_SCREENS = { readings: LogScreen, medicines: MedsScreen, records: HistoryScreen, health: HealthScreen };

function LoadingVeil() {
  const { loading } = useData();
  if (!loading) return null;
  return (
    <View style={styles.veil} pointerEvents="none">
      <ActivityIndicator color={C.brand2} />
    </View>
  );
}

/* A family member's record, opened from Family → View details. Each
   shared section is a tab rendering the SAME screen the app uses for
   your own data, inside a DataProvider pointed at that person — so
   everything there (adding readings, marking doses, editing records)
   reads and writes their record, with the backend checking the share
   on every call. Only the sections they shared appear. */
export default function FamilyMemberScreen({ route }) {
  const go = useGo();
  const { ownerId, name, username, scopes = [], openedAt } = route.params || {};
  const tabs = FAMILY_SCOPES.filter(s => scopes.includes(s.key));
  const [tab, setTab] = useState(tabs[0]?.key);

  // opening a different person (or the same one again) starts on their first shared tab
  useEffect(() => {
    setTab(tabs[0]?.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, openedAt]);

  if (!ownerId) return null;
  const Section = SECTION_SCREENS[tab];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Press onPress={() => go('family')} style={styles.backBtn}>
          <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 6l-6 6 6 6" />
          </Svg>
        </Press>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Mono style={{ marginTop: 2 }}>@{username} · shared with you</Mono>
        </View>
      </View>

      {tabs.length > 1 && (
        <View style={styles.tabsWrap}>
          <Seg value={tab} onChange={setTab} options={tabs.map(t => ({ value: t.key, label: t.label }))} />
        </View>
      )}

      {/* keyed so a different person — or reopening — reloads fresh data */}
      <DataProvider key={`${ownerId}:${openedAt}`} familyOwner={ownerId} scopes={scopes}>
        <View style={{ flex: 1 }}>
          {Section ? <Section /> : <Text style={styles.empty}>{name} isn't sharing anything with you right now.</Text>}
          <LoadingVeil />
        </View>
      </DataProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 999, borderWidth: 1, borderColor: C.hair, backgroundColor: C.cardSolid, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: SANS.bold, fontSize: 21, letterSpacing: -0.6, color: C.ink },
  tabsWrap: { paddingHorizontal: 16, paddingBottom: 4 },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 60, alignItems: 'center' },
  empty: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, padding: 20, textAlign: 'center' },
});
