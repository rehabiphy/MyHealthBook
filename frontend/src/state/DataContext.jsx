import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { SLOTS, dayKey } from '../lib/meds';
import * as readingsApi from '../lib/readingsApi';
import * as recordsApi from '../lib/recordsApi';
import * as medsApi from '../lib/medsApi';
import * as profileApi from '../lib/profileApi';

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
  care: { role: 'logger', circle: [], received: [], day: 0 },
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

/* Backed by the Readings/Records/Meds/Profile APIs now, not
   AsyncStorage. Kept as ONE context (not split per module) because
   HomeScreen/CoachScreen/HealthScreen/FamilySheet/ViewerScreen/
   DoseBanner all already depend on one unified `data` shape.

   `chat` (CoachScreen) and `care.circle`/`care.received`/`care.day`
   (FamilySheet/ViewerScreen) are NOT part of this migration — every
   merge below is careful to leave those exactly as they already are
   in local state rather than overwriting them from a server response
   that doesn't own them. `setData` stays exported as a raw escape
   hatch for those still-local-only fields. */
export function DataProvider({ children }) {
  const { token } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setData(EMPTY);
      setReady(true);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [readings, records, meds, taken, settings, profile] = await Promise.all([
          readingsApi.getReadings(token),
          recordsApi.getRecords(token),
          medsApi.getMedicines(token),
          medsApi.getTaken({}, token),
          medsApi.getMedSettings(token),
          profileApi.getProfile(token),
        ]);
        if (cancelled) return;
        setData(d => ({
          ...d,
          bp: readings.bp,
          body: readings.body,
          sugar: readings.sugar,
          history: records.records,
          meds: meds.medicines,
          taken: reconstructTakenMap(taken.rows),
          medSettings: settings.settings,
          profile: profile.profile,
          health: profile.health,
          care: { ...d.care, role: profile.care.role },
        }));
      } catch {
        // leave whatever was already loaded in place; screens still render
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // ---- Readings ----

  const addBpReading = async ({ sys, dia, pulse }) => {
    const res = await readingsApi.addBpReading({ sys, dia, pulse }, token);
    setData(d => ({ ...d, bp: [res.reading, ...d.bp] }));
  };

  const addBodyReading = async ({ weightKg, heightCm }) => {
    const profileRes = await profileApi.updateProfile({ heightCm }, token);
    setData(d => ({ ...d, profile: profileRes.profile }));
    const res = await readingsApi.addBodyReading({ weightKg }, token);
    setData(d => ({ ...d, body: [res.reading, ...d.body] }));
  };

  const addSugarReading = async ({ mgdl, kind }) => {
    const res = await readingsApi.addSugarReading({ mgdl, kind }, token);
    setData(d => ({ ...d, sugar: [res.reading, ...d.sugar] }));
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

  const addOrUpdateHistory = async draft => {
    const exists = data.history.some(r => r.id === draft.id);
    if (exists) {
      const res = await recordsApi.updateRecord(draft.id, draft, token);
      setData(d => ({ ...d, history: d.history.map(r => (r.id === draft.id ? res.record : r)) }));
      return res.record;
    }
    const res = await recordsApi.createRecord(draft, token);
    setData(d => ({ ...d, history: [res.record, ...d.history] }));
    return res.record;
  };

  const deleteHistory = async id => {
    await recordsApi.deleteRecord(id, token);
    setData(d => ({ ...d, history: d.history.filter(r => r.id !== id) }));
  };

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

  const setCareRole = async role => {
    const res = await profileApi.setCareRole(role, token);
    setData(d => ({ ...d, care: { ...d.care, role: res.care.role } }));
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
    promoteHistoryToMedicine,
    addMedicine,
    setMedStatus,
    restockMedicine,
    toggleDoseTaken,
    updateMedSettings,
    saveProfile,
    setCareRole,
    saveHealth,
  };

  return <DataContext.Provider value={{ data, setData, ready, loading, ...actions }}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
