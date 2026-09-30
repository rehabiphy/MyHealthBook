import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, GLASS } from '../theme/colors';
import { SANS } from '../theme/typography';
import { useData } from '../state/DataContext';
import { useAsk } from '../state/AskDialogContext';
import { useGo } from '../navigation/useGo';
import Screen, { Section } from '../components/layout/Screen';
import Card from '../components/atoms/Card';
import Btn from '../components/atoms/Btn';
import ReportSheet from '../components/dialogs/ReportSheet';

function Count({ n, label }) {
  return (
    <View style={styles.count}>
      <Text style={styles.countN}>{n}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

// Profile → Reports & your data
export default function DataReportsScreen() {
  const { data, deleteAllReadings } = useData();
  const ask = useAsk();
  const go = useGo();
  const [report, setReport] = useState(false);
  const [note, setNote] = useState('');

  const deleteReadings = async () => {
    const ok = await ask({
      title: 'Delete every reading?',
      body: 'All blood pressure, weight and sugar readings will be removed. Your medicines and medical history stay.',
      confirmLabel: 'Delete readings',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteAllReadings();
      setNote('All readings deleted');
    } catch (err) {
      setNote(err.message);
    }
  };

  return (
    <Screen title="Reports & your data" back>
      <Card>
        <Text style={styles.title}>Vitals report for your doctor</Text>
        <Text style={styles.body}>Your readings, averages and medicines in one report. Share it on WhatsApp, by email, or save it as a PDF.</Text>
        <Btn style={{ marginTop: 14 }} onClick={() => setReport(true)}>
          Open report
        </Btn>
        <Btn kind="quiet" style={{ marginTop: 8 }} onClick={() => go('health')}>
          Doctor-ready health summary
        </Btn>
      </Card>

      <Section title="Saved to your account">
        <View style={styles.counts}>
          <Count n={data.bp.length} label="Blood pressure" />
          <Count n={data.sugar.length} label="Sugar" />
          <Count n={data.body.length} label="Weight" />
          <Count n={data.meds.length} label="Medicines" />
          <Count n={(data.history || []).length} label="Records" />
        </View>
        <Text style={styles.small}>Everything is stored securely with your account, so it's there on any phone you sign in on.</Text>
      </Section>

      <Section title="Delete">
        <Card>
          <Text style={styles.body}>Remove all blood pressure, weight and sugar readings. Medicines and medical history are not affected. This cannot be undone.</Text>
          <Btn kind="quiet" style={{ marginTop: 12 }} textStyle={{ color: C.stage2 }} onClick={deleteReadings}>
            Delete all readings
          </Btn>
          {note ? <Text style={[styles.small, { textAlign: 'center' }]}>{note}</Text> : null}
        </Card>
      </Section>

      {report && <ReportSheet data={data} onClose={() => setReport(false)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: SANS.semibold, fontSize: 18, color: C.ink },
  body: { fontFamily: SANS.regular, fontSize: 15, lineHeight: 22, color: C.ink2, marginTop: 4 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  count: { minWidth: '30%', flexGrow: 1, ...GLASS, borderRadius: 18, padding: 12 },
  countN: { fontFamily: SANS.bold, fontSize: 22, color: C.ink },
  countLabel: { fontFamily: SANS.regular, fontSize: 14, color: C.ink2, marginTop: 1 },
  small: { fontFamily: SANS.regular, fontSize: 13.5, lineHeight: 19, color: C.ink3, marginTop: 10, paddingHorizontal: 4 },
});
