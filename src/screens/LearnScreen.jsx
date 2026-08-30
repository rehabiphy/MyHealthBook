import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from '../theme/colors';
import { SANS } from '../theme/typography';
import { ARTICLES } from '../lib/articles';
import Head from '../components/atoms/Head';
import Mono from '../components/atoms/Mono';
import Press from '../components/atoms/Press';
import Rise from '../components/atoms/Rise';
import { G } from '../components/icons/ScreenGlyphs';

export default function LearnScreen() {
  const [open, setOpen] = useState(null);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Head title="Learn" caption={`${ARTICLES.length} reads · general information, not advice`} icon={G.learn(C.low)} tint={C.low} />
      {ARTICLES.map((a, i) => (
        <Press key={i} onPress={() => setOpen(open === i ? null : i)} style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Mono style={{ fontSize: 9.5 }}>{String(i + 1).padStart(2, '0')}</Mono>
              <Text style={styles.title}>{a.t}</Text>
              <Text style={styles.desc}>{a.d}</Text>
            </View>
            <View style={[styles.chevron, open === i && styles.chevronOpen]}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round">
                <Path d="M6 9l6 6 6-6" />
              </Svg>
            </View>
          </View>
          {open === i && (
            <Rise style={styles.body}>
              {a.body.map((p, j) => (
                <Text key={j} style={styles.paragraph}>
                  {p}
                </Text>
              ))}
            </Rise>
          )}
        </Press>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20, paddingBottom: 120 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 18,
    padding: 18,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  title: { fontFamily: SANS.semibold, fontSize: 16.5, letterSpacing: -0.4, marginTop: 5, color: C.ink },
  desc: { fontFamily: SANS.regular, fontSize: 13.5, color: C.ink2, marginTop: 3 },
  chevron: { marginTop: 20, flexShrink: 0 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  body: { marginTop: 16, borderTopWidth: 1, borderTopColor: C.hair, paddingTop: 14 },
  paragraph: { fontFamily: SANS.regular, fontSize: 14.5, lineHeight: 23, color: C.ink2, marginBottom: 11 },
});
