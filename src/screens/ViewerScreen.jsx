import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C } from '../theme/colors';
import { SANS, MONO } from '../theme/typography';
import { fmtDay, uid } from '../lib/calc';
import { openLink, toWhatsAppUrl } from '../lib/share';
import { useData } from '../state/DataContext';
import Head from '../components/atoms/Head';
import Card from '../components/atoms/Card';
import Mono from '../components/atoms/Mono';
import Btn from '../components/atoms/Btn';
import { G } from '../components/icons/ScreenGlyphs';

export default function ViewerScreen() {
  const { data, setData } = useData();
  const care = data.care || { role: 'viewer', circle: [], received: [] };
  const [paste, setPaste] = useState('');
  const received = care.received || [];

  const save = () => {
    if (!paste.trim()) return;
    setData(d => ({ ...d, care: { ...care, received: [{ id: uid(), ts: Date.now(), text: paste.trim() }, ...received] } }));
    setPaste('');
  };

  const nudge = () => {
    const who = care.circle[0];
    const msg = 'Hi, just checking in — could you take a BP reading and send this week\'s update from the app?';
    openLink(toWhatsAppUrl((who?.phone || '').replace(/\D/g, ''), msg));
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Head title="Updates" icon={G.records(C.brand)} tint={C.brand} caption={received.length ? `Last received ${fmtDay(received[0].ts).toLowerCase()}` : 'Nothing received yet'} />

      {received[0] && (
        <View style={styles.latestCard}>
          <Mono style={{ color: C.onPanel2 }}>Latest</Mono>
          <Text style={styles.latestText}>{received[0].text}</Text>
        </View>
      )}

      <Card style={{ marginTop: 10 }}>
        <Mono>Paste an update</Mono>
        <TextInput
          value={paste}
          onChangeText={setPaste}
          multiline
          numberOfLines={4}
          placeholder="Paste the WhatsApp message here to keep it"
          placeholderTextColor={C.ink3}
          style={styles.pasteInput}
        />
        <View style={styles.row2}>
          <Btn kind="quiet" style={{ flex: 1 }} onClick={nudge}>
            Nudge them
          </Btn>
          <Btn style={{ flex: 1 }} disabled={!paste.trim()} onClick={save}>
            Keep it
          </Btn>
        </View>
      </Card>

      {received.length > 1 && (
        <>
          <View style={styles.sectionPad}>
            <Mono>Earlier</Mono>
          </View>
          {received.slice(1).map(r => (
            <Card key={r.id} style={{ marginBottom: 8 }}>
              <Mono>
                {fmtDay(r.ts)} · {new Date(r.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
              </Mono>
              <Text style={styles.earlierText}>{r.text}</Text>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 20, paddingBottom: 120 },
  latestCard: { backgroundColor: C.panel, borderRadius: 22, padding: 20, marginTop: 16 },
  latestText: { fontFamily: MONO.regular, fontSize: 14, lineHeight: 23, color: C.onPanel, marginTop: 12 },
  pasteInput: {
    width: '100%',
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 14,
    padding: 13,
    fontFamily: SANS.regular,
    fontSize: 15,
    color: C.ink,
    backgroundColor: 'rgba(255,255,255,0.10)',
    minHeight: 90,
    textAlignVertical: 'top',
  },
  row2: { flexDirection: 'row', gap: 8, marginTop: 10 },
  sectionPad: { paddingTop: 24, paddingHorizontal: 4, paddingBottom: 10 },
  earlierText: { fontFamily: MONO.regular, fontSize: 13, lineHeight: 21, color: C.ink2, marginTop: 10 },
});
