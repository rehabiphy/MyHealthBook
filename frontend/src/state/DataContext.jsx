import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { SLOTS, dayKey } from '../lib/meds';
import * as readingsApi from '../lib/readingsApi';
import * as recordsApi from '../lib/recordsApi';
import * as medsApi from '../lib/medsApi';
import * as profileApi from '../lib/profileApi';
import { useMedReminderSync } from '../lib/medReminders';
import { uploadAttachment } from '../lib/attachments';

export const EMPTY = {
  profile: { name: '', age: '', sex: '', heightCm: '', diet: 'veg' },
  bp: [],
  body: [],
  sugar: [],
  chat: [],
  meds: [],
  taken: {},
  health: { conditions: [], allergies: '', bloodGroup: '', upcoming: [] },
  history: [],
  medSettings: { times: Object.fromEntries(SLOTS.map(s => [s.key, s.time])), lead: 10, notify: false },
};

/* Turns the flat DoseLog rows the API returns back into the nested
   {[day]: {[medId|slotKey]: takenAt}} map lib/meds.js's isTaken/
   dosesToday/adherence already expect, unchanged. */
function reconstructTakenMap(rows) {
  const out = {};
  for (const r of rows) {
    if (!out[r.day]) out[r.day] = {};
    out[r.day][`${r.medId}|${r.slotKey}`] = r.takenAt;
  }
  return out;
}

const DataContext = createContext(null);

const ALL_SCOPES = ['readings', 'medicines', 'records', 'health'];

/* Backed by the Readings/Records/Meds/Profile APIs now, not
   AsyncStorage. Kept as ONE context (not split per module) because
   HomeScreen/CoachScreen/HealthScreen/DoseBanner all already depend on
   one unified `data` shape.

   `chat` (CoachScreen) is NOT part of this migration — every merge
   below leaves it exactly as it already is in local state. `setData`
   stays exported as a raw escape hatch for it.

   With `familyOwner` set (a user id), the same provider serves a family
   member's record instead of the signed-in user's: every API call acts
   on that person (see apiClient.js), and only the sections in `scopes`
   they shared are loaded. Wrapping the existing screens in one of these
   is how the Family page shows — and edits — someone else's data. */
export function DataProvider({ children, familyOwner = null, scopes = ALL_SCOPES }) {
  const { token: sessionToken, user, ready: authReady } = useAuth();
  const scopeKey = scopes.join(',');
  // stable while the inputs are, so it can sit in effect deps
  const token = useMemo(() => (familyOwner && sessionToken ? { token: sessionToken, familyOwner } : sessionToken), [sessionToken, familyOwner]);
  const [data, setData] = useState(EMPTY);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  /* The token whose data has finished loading. `ready` can already be
     true while a signed-in user's data is still in flight (it was set
     for the signed-out state first), so anything that must see the real
     profile — like the spoken launch greeting — waits on this instead. */
  const [loadedToken, setLoadedToken] = useState(null);
  // the token whose medicines + medicine settings actually came back — offline, the reminder schedule is left alone
  const [medsToken, setMedsToken] = useState(null);

  useEffect(() => {
    if (!token) {
      setData(EMPTY);
      setReady(true);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const has = s => scopeKey.split(',').includes(s);
    (async () => {
      setLoading(true);
      try {
        // each section loads on its own, so one failing (or not shared) doesn't blank the rest
        const [readings, records, meds, taken, settings, profile] = await Promise.all(
          [
            has('readings') && readingsApi.getReadings(token),
            has('records') && recordsApi.getRecords(token),
            has('medicines') && medsApi.getMedicines(token),
            has('medicines') && medsApi.getTaken({}, token),
            has('medicines') && medsApi.getMedSettings(token),
            profileApi.getProfile(token),
          ].map(p => (p ? p.catch(() => null) : null)),
        );
        if (cancelled) return;
        setData(d => ({
          ...d,
          ...(readings && { bp: readings.bp, body: readings.body, sugar: readings.sugar }),
          ...(records && { history: records.records }),
          ...(meds && { meds: meds.medicines }),
          ...(taken && { taken: reconstructTakenMap(taken.rows) }),
          ...(settings && { medSettings: settings.settings }),
          ...(profile && { profile: profile.profile, health: profile.health }),
        }));
        if (meds && settings) setMedsToken(token);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
          setLoadedToken(token);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, scopeKey]);

  // ---- Readings ----

  const addBpReading = async ({ sys, dia, pulse }) => {
    const res = await readingsApi.addBpReading({ sys, dia, pulse }, token);
    setData(d => ({ ...d, bp: [res.reading, ...d.bp] }));
    return res.reading;
  };

  const addBodyReading = async ({ weightKg, heightCm }) => {
    // height lives on the profile — only write it when it actually changed (a family member may share readings but not health)
    if (heightCm && String(heightCm) !== String(data.profile.heightCm || '')) {
      const profileRes = await profileApi.updateProfile({ heightCm }, token);
      setData(d => ({ ...d, profile: profileRes.profile }));
    }
    const res = await readingsApi.addBodyReading({ weightKg }, token);
    setData(d => ({ ...d, body: [res.reading, ...d.body] }));
    return res.reading;
  };

  const addSugarReading = async ({ mgdl, kind }) => {
    const res = await readingsApi.addSugarReading({ mgdl, kind }, token);
    setData(d => ({ ...d, sugar: [res.reading, ...d.sugar] }));
    return res.reading;
  };

  const deleteReading = async (type, id) => {
    await readingsApi.deleteReading(type, id, token);
    setData(d => ({ ...d, [type]: d[type].filter(r => r.id !== id) }));
  };

  const deleteAllReadings = async () => {
    await readingsApi.deleteAllReadings(token);
    setData(d => ({ ...d, bp: [], body: [], sugar: [], chat: [] }));
  };

  // ---- Records ----

  /* draft.upload — a report file just uploaded to S3 ({ key, name }) to attach;
     draft.removeAttachment — take the current one off. Otherwise the file is left as it is. */
  const addOrUpdateHistory = async draft => {
    const { upload, removeAttachment, attachment, ...fields } = draft;
    const payload = { ...fields, ...(upload ? { attachment: { key: upload.key, name: upload.name } } : removeAttachment ? { attachment: null } : {}) };
    const exists = data.history.some(r => r.id === draft.id);
    if (exists) {
      const res = await recordsApi.updateRecord(draft.id, payload, token);
      setData(d => ({ ...d, history: d.history.map(r => (r.id === draft.id ? res.record : r)) }));
      return res.record;
    }
    const res = await recordsApi.createRecord(payload, token);
    setData(d => ({ ...d, history: [res.record, ...d.history] }));
    return res.record;
  };

  const deleteHistory = async id => {
    await recordsApi.deleteRecord(id, token);
    setData(d => ({ ...d, history: d.history.filter(r => r.id !== id) }));
  };

  // report files: uploaded before the record is saved, opened through a short-lived link
  const uploadRecordFile = (file, onProgress, opts) => uploadAttachment(file, token, onProgress, opts);
  const recordFileUrl = async id => (await recordsApi.getAttachmentUrl(id, token)).url;

  const promoteHistoryToMedicine = async record => {
    const medRes = await medsApi.createMedicine(
      { name: record.medName, dose: record.medDose, slots: ['breakfast'], perDose: 1, fromHistory: record.id },
      token,
    );
    const recRes = await recordsApi.updateRecord(record.id, { promoted: true }, token);
    setData(d => ({
      ...d,
      meds: [...d.meds, medRes.medicine],
      history: d.history.map(r => (r.id === record.id ? recRes.record : r)),
    }));
  };

  // ---- Medicines ----

  const addMedicine = async vals => {
    const res = await medsApi.createMedicine(vals, token);
    setData(d => ({ ...d, meds: [...d.meds, res.medicine] }));
    return res.medicine;
  };

  // hard delete, dose history included — for a medicine added by mistake or one the user removes from "Not taking now"
  const deleteMedicine = async id => {
    await medsApi.deleteMedicine(id, token);
    setData(d => ({ ...d, meds: d.meds.filter(m => m.id !== id) }));
  };

  const setMedStatus = async (id, status, reason) => {
    const res = await medsApi.setMedicineStatus(id, status, reason, token);
    setData(d => ({ ...d, meds: d.meds.map(m => (m.id === id ? res.medicine : m)) }));
  };

  const restockMedicine = async (id, qty) => {
    const res = await medsApi.restockMedicine(id, qty, token);
    setData(d => ({ ...d, meds: d.meds.map(m => (m.id === id ? res.medicine : m)) }));
  };

  const toggleDoseTaken = async doseId => {
    const [medId, slotKey] = doseId.split('|');
    const day = dayKey();
    const res = await medsApi.toggleTaken({ medId, slotKey, day }, token);
    setData(d => {
      const dayMap = { ...(d.taken?.[day] || {}) };
      if (res.taken) dayMap[doseId] = res.takenAt;
      else delete dayMap[doseId];
      return { ...d, taken: { ...(d.taken || {}), [day]: dayMap } };
    });
  };

  const updateMedSettings = async patch => {
    const res = await medsApi.updateMedSettings(patch, token);
    setData(d => ({ ...d, medSettings: res.settings }));
  };

  // ---- Profile ----

  const saveProfile = async draft => {
    const res = await profileApi.updateProfile(draft, token);
    setData(d => ({ ...d, profile: res.profile }));
  };

  const saveHealth = async health => {
    const res = await profileApi.updateHealth(health, token);
    setData(d => ({ ...d, health: res.health }));
  };

  const actions = {
    addBpReading,
    addBodyReading,
    addSugarReading,
    deleteReading,
    deleteAllReadings,
    addOrUpdateHistory,
    deleteHistory,
    uploadRecordFile,
    recordFileUrl,
    promoteHistoryToMedicine,
    addMedicine,
    deleteMedicine,
    setMedStatus,
    restockMedicine,
    toggleDoseTaken,
    updateMedSettings,
    saveProfile,
    saveHealth,
  };

  const loaded = Boolean(token) && loadedToken === token;

  // medicine reminders on this phone follow the signed-in user's own medicines (lib/medReminders.js)
  useMedReminderSync({
    data,
    name: data.profile?.name || user?.name,
    own: !familyOwner,
    // null until the saved session is restored — only a real sign-out clears the schedule, not a cold start
    signedIn: authReady ? Boolean(sessionToken) : null,
    loaded: Boolean(token) && medsToken === token,
  });

  return <DataContext.Provider value={{ data, setData, ready, loading, loaded, familyOwner, ...actions }}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
