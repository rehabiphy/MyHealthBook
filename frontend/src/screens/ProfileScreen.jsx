import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { C, GLASS } from '../theme/colors';
import { SANS } from '../theme/typography';
import { GRAD } from '../theme/gradients';
import { kg1 } from '../lib/calc';
import { useData } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { useAsk } from '../state/AskDialogContext';
import { useSubscription } from '../state/SubscriptionContext';
import { useGo } from '../navigation/useGo';
import Screen, { Section } from '../components/layout/Screen';
import { ListGroup, ListRow } from '../components/layout/ListRow';
import Press from '../components/atoms/Press';
import { G } from '../components/icons/ScreenGlyphs';

const SEX = { male: 'Male', female: 'Female', other: 'Other' };

const icon = d => c =>
  (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
const I = {
  people: icon('M9 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19c1-2.6 3-4 5.5-4s4.5 1.4 5.5 4M16.5 12a2.2 2.2 0 1 0 0-4.4M16 14.2c2 .2 3.5 1.5 4.3 3.4'),
  bell: icon('M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9zM13.7 19.5a2 2 0 0 1-3.4 0'),
  shield: icon('M12 3.5l7 3v5c0 4.3-3 7.7-7 9-4-1.3-7-4.7-7-9v-5z M9 12l2 2 4-4'),
  file: icon('M6 3.8h8.2L18.5 8v12.2H6zM14 3.8V8h4.4M9 13h6M9 16.5h4'),
  logout: icon('M14 4.5h4.5v15H14M10 8l-4 4 4 4M6 12h9'),
};

/* Profile is a menu, not a form: who you are at the top, then one row
   per thing you might come here to do, each opening its own page. */
export default function ProfileScreen() {
  const { data } = useData();
  const { user, signOut } = useAuth();
  const { subscription, tier, source } = useSubscription();
  const ask = useAsk();
  const go = useGo();

  const p = data.profile;
  const h = data.health || { conditions: [], allergies: '', bloodGroup: '' };
  const w = data.body[0];
  const name = p.name || user?.name || '';
  const initials = name
    .trim()
    .split(/\s+/)
    .map(x => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const facts = [p.age && `${p.age} years`, SEX[p.sex], p.heightCm && `${p.heightCm} cm`, w && `${kg1(w.weightKg)} kg`].filter(Boolean).join(' · ');

  const planLabel = tier === 'free' ? 'Free' : source === 'family' ? 'Plus (via Family)' : subscription.label;
  const planNote =
    subscription.status === 'CANCELLED'
      ? 'Cancelled — active until its end date'
      : subscription.status === 'GRACE_PERIOD'
      ? 'Ended — renew to keep its features'
      : tier === 'free'
      ? 'See what Plus and Family add'
      : 'Manage your plan';

  const logOut = async () => {
    const ok = await ask({ title: 'Log out?', body: 'You can log back in anytime with your email and password.', confirmLabel: 'Log out', cancelLabel: 'Cancel', danger: true });
    if (ok) signOut();
  };

  return (
    <Screen title="Profile">
      <Press onPress={() => go('profileDetails')} style={styles.identity} accessibilityLabel="Edit personal details">
        <LinearGradient colors={GRAD.colors} start={GRAD.start} end={GRAD.end} style={styles.avatar}>
          <Text style={styles.avatarLabel}>{initials || '—'}</Text>
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name || 'Add your name'}
          </Text>
          {user?.username ? <Text style={styles.handle}>@{user.username}</Text> : null}
          <Text style={styles.facts}>{facts || 'Add your age, height and more'}</Text>
        </View>
        <View style={[styles.planPill, tier !== 'free' && styles.planPillPaid]}>
          <Text style={[styles.planPillText, tier !== 'free' && styles.planPillTextPaid]}>{tier === 'free' ? 'Free' : tier === 'family' ? 'Family' : 'Plus'}</Text>
        </View>
      </Press>

      {(h.bloodGroup || h.allergies || h.conditions.length > 0) && (
        <View style={styles.tags}>
          {h.bloodGroup ? (
            <View style={[styles.tag, { backgroundColor: C.stage2 }]}>
              <Text style={styles.tagWhite}>Blood {h.bloodGroup}</Text>
            </View>
          ) : null}
          {h.allergies ? (
            <View style={[styles.tag, { backgroundColor: C.elevated }]}>
              <Text style={styles.tagWhite}>Allergy: {h.allergies}</Text>
            </View>
          ) : null}
          {h.conditions.map(c => (
            <View key={c} style={[styles.tag, styles.tagOutline]}>
              <Text style={styles.tagOutlineText}>{c}</Text>
            </View>
          ))}
        </View>
      )}

      <Section title="Your health book">
        <ListGroup>
          <ListRow icon={G.me(C.brand2)} tint={C.brand2} title="Personal details" subtitle="Name, age, height, diet, your doctor" onPress={() => go('profileDetails')} />
          <ListRow icon={G.health(C.stage2)} tint={C.stage2} title="Health summary" subtitle="Conditions, allergies, blood group, follow-ups" onPress={() => go('health')} />
          <ListRow icon={I.file(C.low)} tint={C.low} title="Reports & your data" subtitle="Share a report with your doctor, export" onPress={() => go('dataReports')} />
        </ListGroup>
      </Section>

      <Section title="Plan & family">
        <ListGroup>
          <ListRow icon={G.premium(C.brand2)} tint={C.brand2} title="Subscription" subtitle={planNote} value={planLabel} onPress={() => go('subscription')} />
          <ListRow icon={I.people(C.normal)} tint={C.normal} title="Family" subtitle="Share your record, see family members'" onPress={() => go('family')} />
        </ListGroup>
      </Section>

      <Section title="Settings">
        <ListGroup>
          <ListRow icon={I.bell(C.elevated)} tint={C.elevated} title="Notifications" subtitle="Medicine reminders, daily health tip" onPress={() => go('notificationSettings')} />
          <ListRow icon={I.shield(C.stage1)} tint={C.stage1} title="Safety" subtitle="Fall detection and SOS to family" onPress={() => go('safety')} />
        </ListGroup>
      </Section>

      <ListGroup style={{ marginTop: 26 }}>
        <ListRow icon={I.logout(C.stage2)} tint={C.stage2} title="Log out" danger chevron={false} onPress={logOut} />
      </ListGroup>

      <Text style={styles.disclaimer}>
        MyHealthBook records what you measure and explains standard reference ranges. It does not diagnose, prescribe or change medicines — take your readings to your doctor.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, ...GLASS, borderRadius: 24, padding: 18 },
  avatar: { width: 60, height: 60, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: SANS.bold, fontSize: 21, color: '#FFFFFF' },
  name: { fontFamily: SANS.bold, fontSize: 21, letterSpacing: -0.5, color: C.ink },
  handle: { fontFamily: SANS.medium, fontSize: 14.5, color: C.brand2, marginTop: 1 },
  facts: { fontFamily: SANS.regular, fontSize: 14.5, color: C.ink2, marginTop: 3 },
  planPill: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(22,36,28,0.06)', alignSelf: 'flex-start' },
  planPillPaid: { backgroundColor: C.brand },
  planPillText: { fontFamily: SANS.semibold, fontSize: 13, color: C.ink2 },
  planPillTextPaid: { color: '#FFFFFF' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  tagWhite: { fontFamily: SANS.semibold, fontSize: 14, color: '#FFFFFF' },
  tagOutline: { ...GLASS },
  tagOutlineText: { fontFamily: SANS.semibold, fontSize: 14, color: C.ink2 },
  disclaimer: { fontFamily: SANS.regular, fontSize: 13.5, lineHeight: 20, color: C.ink3, marginTop: 20, paddingHorizontal: 4 },
});
