import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { C } from '../../theme/colors';
import { GRAD_SHEET } from '../../theme/gradients';
import { MONO, SANS } from '../../theme/typography';
import { buildReport, buildReportHTML, buildShareText } from '../../lib/report';
import { copyText, exportJson, nativeShareText, openLink, shareReportPdf, toMailtoUrl, toWhatsAppUrl } from '../../lib/share';
import Mono from '../atoms/Mono';
import Btn from '../atoms/Btn';
import Press from '../atoms/Press';

export default function ReportSheet({ data, onClose }) {
  const text = useMemo(() => buildReport(data), [data]);
  const short = useMemo(() => buildShareText(data), [data]);
  const [note, setNote] = useState('');
  const say = m => {
    setNote(m);
    setTimeout(() => setNote(''), 3000);
  };
  const doc = data.profile.docPhone ? data.profile.docPhone.replace(/\D/g, '') : '';
  const mail = data.profile.docEmail || '';
  const subject = `Vitals report${data.profile.name ? ` — ${data.profile.name}` : ''}`;

  const doShare = async () => {
    const ok = await nativeShareText(subject, short);
    if (ok) return say('Shared');
    say((await copyText(short)) ? 'Report copied — paste it into WhatsApp' : 'Sharing unavailable here');
  };

  const toWhatsApp = async () => {
    const ok = await openLink(toWhatsAppUrl(doc, short));
    if (!ok) say("Couldn't open WhatsApp — use Share instead");
    else if (!doc) say("Pick your doctor's chat in WhatsApp");
  };

  const toEmail = async () => {
    const ok = await openLink(toMailtoUrl(mail, subject, short));
    if (!ok) say("Couldn't open your mail app — use Share instead");
    else say('Attach the PDF if your doctor wants the full log');
  };

  const savePdf = async () => {
    const ok = await shareReportPdf(buildReportHTML(data), `vitals-report-${new Date().toISOString().slice(0, 10)}`);
    say(ok ? 'PDF ready to share or save' : 'Could not generate the PDF');
  };

  const doCopy = async () => say((await copyText(text)) ? 'Full report copied' : 'Copy failed. Try again.');

  const doExport = async () => say((await exportJson(data)) ? 'Ready to save' : 'Export failed. Try again.');

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <LinearGradient colors={GRAD_SHEET.colors} locations={GRAD_SHEET.locations} start={GRAD_SHEET.start} end={GRAD_SHEET.end} style={styles.root}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h2}>Report</Text>
            <Mono style={styles.sub}>For your doctor</Mono>
          </View>
          <Press onPress={onClose} style={styles.closeBtn}>
            <Svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round">
              <Path d="M6 6l12 12M18 6L6 18" />
            </Svg>
          </Press>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={{ padding: 16 }}>
          <View style={styles.pre}>
            <Text style={styles.preText}>{text}</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {note ? <Text style={styles.note}>{note}</Text> : null}

          <Btn style={{ paddingVertical: 15 }} onClick={doShare}>
            Share report
          </Btn>

          <View style={styles.row}>
            <Btn kind="quiet" style={styles.rowBtn} onClick={toWhatsApp}>
              <View style={styles.iconLabel}>
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.4L3.5 20.5l1.6-4.6A8.4 8.4 0 1 1 20.5 11.6z" />
                  <Path d="M8.9 9.1c.3 2.3 2.4 4.4 4.7 4.7l.9-1.2 1.7.8c-.3 1.1-1.4 1.6-2.5 1.4-2.7-.5-5-2.8-5.5-5.5-.2-1.1.3-2.2 1.4-2.5l.8 1.7z" />
                </Svg>
                <Text style={styles.rowBtnLabel}>WhatsApp</Text>
              </View>
            </Btn>
            <Btn kind="quiet" style={styles.rowBtn} onClick={toEmail}>
              <View style={styles.iconLabel}>
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <Rect x="3" y="5.5" width="18" height="13" rx="2" />
                  <Path d="M3.5 7l8.5 6 8.5-6" />
                </Svg>
                <Text style={styles.rowBtnLabel}>Email</Text>
              </View>
            </Btn>
          </View>

          <View style={styles.row}>
            <Btn kind="quiet" style={styles.rowBtn} onClick={savePdf}>
              Save as PDF
            </Btn>
            <Btn kind="quiet" style={styles.rowBtn} onClick={doCopy}>
              Copy text
            </Btn>
          </View>

          <Press onPress={doExport} style={styles.exportWrap}>
            <Text style={styles.exportLabel}>Export raw data (.json)</Text>
          </Press>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.hair,
  },
  h2: { fontFamily: SANS.bold, fontSize: 19, letterSpacing: -0.6, color: C.ink },
  sub: { marginTop: 3 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.hair,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  pre: {
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 16,
    padding: 16,
    backgroundColor: C.card,
  },
  preText: {
    fontFamily: MONO.regular,
    fontSize: 11,
    lineHeight: 19,
    color: C.ink,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: C.hair,
    backgroundColor: C.paper,
    gap: 8,
  },
  note: {
    fontFamily: SANS.regular,
    fontSize: 13,
    color: C.ink2,
    textAlign: 'center',
    marginBottom: 2,
    lineHeight: 18,
  },
  row: { flexDirection: 'row', gap: 8 },
  rowBtn: { flex: 1, paddingVertical: 13 },
  iconLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  rowBtnLabel: { fontFamily: SANS.semibold, fontSize: 15, color: C.ink },
  exportWrap: { marginTop: 2, alignItems: 'center', paddingVertical: 6 },
  exportLabel: {
    fontFamily: MONO.regular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.ink3,
  },
});
