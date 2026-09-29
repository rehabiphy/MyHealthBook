jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {},
  AndroidImportance: {},
  AndroidNotificationSetting: { DISABLED: 0 },
  RepeatFrequency: { DAILY: 1 },
  TriggerType: { TIMESTAMP: 0 },
}));
jest.mock('../src/theme/colors', () => ({ C: {} }));

const { reminderPlan } = require('../src/lib/medReminders');

const at = (h, m = 0, dayOffset = 0) => {
  const d = new Date(2026, 8, 29, h, m, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d;
};

const base = {
  medSettings: { times: { breakfast: '09:00', dinner: '21:00', empty: '00:05' }, lead: 10 },
  taken: {},
  meds: [
    { id: 'a', name: 'Metformin', dose: '500 mg', slots: ['breakfast', 'dinner'], status: 'active' },
    { id: 'b', name: 'Amlodipine', dose: '', slots: ['breakfast'], status: 'active' },
    { id: 'c', name: 'Paused', slots: ['breakfast'], status: 'paused' },
  ],
};

test('one reminder per slot, lead applied, grouped meds, paused excluded', () => {
  const plan = reminderPlan(base, 'Parth Panchal', at(8, 0));
  const bf = plan.find(p => p.id === 'med:dose:breakfast');
  expect(new Date(bf.timestamp)).toEqual(at(8, 50));
  expect(bf.repeat).toBe(true);
  expect(bf.body).toBe('Parth, at 9:00 am take Metformin 500 mg, Amlodipine.');
  expect(bf.title).toBe('💊 After breakfast medicine in 10 min');
  const dn = plan.find(p => p.id === 'med:dose:dinner');
  expect(new Date(dn.timestamp)).toEqual(at(20, 50));
  expect(plan.filter(p => p.id.startsWith('med:dose:'))).toHaveLength(2);
});

test('time already passed today -> tomorrow', () => {
  const plan = reminderPlan(base, 'Parth', at(9, 30));
  expect(new Date(plan.find(p => p.id === 'med:dose:breakfast').timestamp)).toEqual(at(8, 50, 1));
});

test('lead wraps past midnight', () => {
  const data = { ...base, meds: [{ id: 'x', name: 'X', slots: ['empty'], status: 'active' }] };
  const plan = reminderPlan(data, '', at(12, 0));
  // 00:05 minus 10 min = 23:55 today
  expect(new Date(plan[0].timestamp)).toEqual(at(23, 55));
  expect(plan[0].body).toBe('At 12:05 am take X.');
});

test('all taken today -> starts tomorrow', () => {
  const data = { ...base, taken: { '2026-09-29': { 'a|breakfast': 1, 'b|breakfast': 1 } } };
  const plan = reminderPlan(data, 'Parth', at(8, 0));
  expect(new Date(plan.find(p => p.id === 'med:dose:breakfast').timestamp)).toEqual(at(8, 50, 1));
  // only one of two taken -> still today
  const partial = { ...base, taken: { '2026-09-29': { 'a|breakfast': 1 } } };
  expect(new Date(reminderPlan(partial, 'P', at(8, 0)).find(p => p.id === 'med:dose:breakfast').timestamp)).toEqual(at(8, 50));
});

test('on-time lead wording', () => {
  const data = { ...base, medSettings: { ...base.medSettings, lead: 0 } };
  const bf = reminderPlan(data, 'Parth', at(8, 0)).find(p => p.id === 'med:dose:breakfast');
  expect(new Date(bf.timestamp)).toEqual(at(9, 0));
  expect(bf.title).toBe('💊 Time for your after breakfast medicine');
  expect(bf.body).toBe('Parth, please take Metformin 500 mg, Amlodipine.');
});

test('refill alerts: 10 am on the days 3,2,1 left, then one run-out, nothing earlier', () => {
  // 2 a day, stocked 20 at 7am today -> 10 days of stock
  const data = { ...base, meds: [{ id: 'r', name: 'Rx', slots: ['breakfast', 'dinner'], status: 'active', stock: 20, stockedAt: at(7, 0).getTime(), perDose: 1 }] };
  const refills = reminderPlan(data, 'Parth', at(8, 0)).filter(p => p.id.startsWith('med:refill:'));
  const got = refills.map(p => [new Date(p.timestamp).getDate(), p.title]);
  expect(got).toEqual([
    [6, '🔔 Rx is running low'], // Oct 6: 7 days used -> 6 left -> 3 days
    [7, '🔔 Rx is running low'],
    [8, '🔔 Rx is running low'],
    [9, '⚠️ Rx has run out'],
  ]);
  expect(refills[0].body).toBe('About 3 days of Rx left. Time to reorder.');
  expect(refills.every(p => new Date(p.timestamp).getHours() === 10)).toBe(true);
});
