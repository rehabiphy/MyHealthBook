import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C, GLASS } from '../../theme/colors';
import { SANS } from '../../theme/typography';
import Press from '../atoms/Press';

/* A settings-style row: tinted icon, title and a line under it, an
   optional value on the right, and a chevron when it opens something.
   Rows sit together inside a ListGroup, which draws the card and the
   hairlines between them. */
export function ListRow({ icon, tint = C.brand, title, subtitle, value, onPress, danger, last, chevron = true }) {
  const inner = (
    <View style={[styles.row, !last && styles.rowBorder]}>
      {icon ? <View style={[styles.icon, { backgroundColor: `${tint}22` }]}>{icon}</View> : null}
      <View style={styles.text}>
        <Text style={[styles.title, danger && { color: C.stage2 }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {onPress && chevron ? (
        <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M9 6l6 6-6 6" />
        </Svg>
      ) : null}
    </View>
  );
  return onPress ? (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      {inner}
    </Press>
  ) : (
    inner
  );
}

export function ListGroup({ children, style }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return <View style={[styles.group, style]}>{rows.map((r, i) => React.cloneElement(r, { last: i === rows.length - 1 }))}</View>;
}

const styles = StyleSheet.create({
  group: { ...GLASS, borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 16, minHeight: 64 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: SANS.semibold, fontSize: 16.5, color: C.ink, letterSpacing: -0.2 },
  subtitle: { fontFamily: SANS.regular, fontSize: 14, color: C.ink3, marginTop: 2, lineHeight: 19 },
  value: { fontFamily: SANS.medium, fontSize: 15, color: C.ink2 },
});
