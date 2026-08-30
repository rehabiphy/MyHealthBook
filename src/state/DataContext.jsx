import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadData, saveData } from '../lib/storage';
import { SLOTS } from '../lib/meds';

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

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data, setData] = useState(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await loadData();
      if (stored) setData({ ...EMPTY, ...stored });
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveData(data);
  }, [data, ready]);

  return <DataContext.Provider value={{ data, setData, ready }}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
