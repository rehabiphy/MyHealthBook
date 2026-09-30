import React, { createContext, useContext } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { C } from '../../theme/colors';
import { SANS } from '../../theme/typography';
import { useTabBarClearance } from '../../navigation/TabBar';
import Press from '../atoms/Press';

/* True when a screen is drawn inside another one — a family member's
   record (FamilyMemberScreen) shows the Readings / Medicines / Records /
   Health screens as tabs under its own header. There the section drops
   its big title and the status-bar inset, which the host already has. */
export const EmbeddedContext = createContext(false);

export function BackButton({ onPress }) {
  const navigation = useNavigation();
  return (
    <Press onPress={onPress || (() => navigation.goBack())} style={styles.iconBtn} accessibilityLabel="Back" hitSlop={8}>
      <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 6l-6 6 6 6" />
      </Svg>
    </Press>
  );
}

export function CloseButton({ onPress, label = 'Close' }) {
  return (
    <Press onPress={onPress} style={styles.iconBtn} accessibilityLabel={label} hitSlop={8}>
      <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.2" strokeLinecap="round">
        <Path d="M6 6l12 12M18 6L6 18" />
      </Svg>
    </Press>
  );
}

// a round icon button for header actions (bell, learn…)
export function IconButton({ onPress, children, label, badge }) {
  return (
    <Press onPress={onPress} style={styles.iconBtn} accessibilityLabel={label} hitSlop={6}>
      {children}
      {badge ? <View style={styles.badge} /> : null}
    </Press>
  );
}

/* Every page is laid out the same way:
     [back]  Title                 [right]
             subtitle
     …content, padded clear of the floating tab bar
   `back`: true → navigation.goBack(); a function → that; omitted → no
   back button (the five main tabs). `scroll={false}` for screens that
   manage their own list. */
export default function Screen({ title, subtitle, back, right, children, scroll = true, refreshControl, contentStyle, keyboard = false, headerExtra }) {
  const embedded = useContext(EmbeddedContext);
  const insets = useSafeAreaInsets();
  const bottomPad = useTabBarClearance();
  // inside a family member's record, a plain "back" would leave their record — only in-page backs (functions) apply
  if (embedded && back === true) back = undefined;
  const showHeader = !(embedded && !back) && (title || back || right);

  const header = showHeader ? (
    <View style={[styles.header, { paddingTop: embedded ? 8 : insets.top + 14 }]}>
      <View style={styles.headerRow}>
        {back ? <BackButton onPress={typeof back === 'function' ? back : undefined} /> : null}
        <View style={styles.titleWrap}>
          {title ? (
            <Text style={[styles.title, back && styles.titleSmall]} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {headerExtra}
    </View>
  ) : (
    <View style={{ height: embedded ? 8 : insets.top + 8 }} />
  );

  if (!scroll) {
    return (
      <View style={styles.flex}>
        {header}
        {children}
      </View>
    );
  }

  const body = (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad }, contentStyle]}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {header}
      {children}
    </ScrollView>
  );

  return keyboard ? (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );
}

/* A titled group of content, with an optional link on the right
   ("See all"). */
export function Section({ title, action, onAction, children, style, first }) {
  return (
    <View style={[first ? null : styles.section, style]}>
      {title ? (
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {action ? (
            <Press onPress={onAction} hitSlop={8}>
              <Text style={styles.sectionAction}>{action}</Text>
            </Press>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: SANS.bold, fontSize: 28, letterSpacing: -0.9, color: C.ink, lineHeight: 34 },
  titleSmall: { fontSize: 22, letterSpacing: -0.6, lineHeight: 28 },
  subtitle: { fontFamily: SANS.regular, fontSize: 15, color: C.ink2, marginTop: 3, lineHeight: 21 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: C.cardSolid,
    borderWidth: 1,
    borderColor: C.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 999, backgroundColor: C.stage2, borderWidth: 1.5, borderColor: C.cardSolid },
  section: { marginTop: 26 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 10 },
  sectionTitle: { fontFamily: SANS.bold, fontSize: 18, letterSpacing: -0.4, color: C.ink },
  sectionAction: { fontFamily: SANS.semibold, fontSize: 15, color: C.brand2 },
});
