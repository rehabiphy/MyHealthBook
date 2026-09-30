/* Readings over a chosen period, for the Trends screen. Everything here
   describes the numbers — counts, averages, lowest/highest, change —
   and never interprets them. No "you have…", no diagnosis. */

const DAY = 864e5;

export const METRICS = [
  { key: 'bp', label: 'Blood pressure', unit: 'mmHg', title: 'Your blood pressure readings over the selected period.' },
  { key: 'pulse', label: 'Heart rate', unit: 'bpm', title: 'Your heart rate readings over the selected period.' },
  { key: 'sugar', label: 'Blood glucose', unit: 'mg/dL', title: 'Your blood glucose readings over the selected period.' },
  { key: 'weight', label: 'Weight', unit: 'kg', title: 'Your weight entries over the selected period.' },
];

export const RANGES = [
  { key: '7', label: '7 days', days: 7 },
  { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '90 days', days: 90 },
  { key: '365', label: '1 year', days: 365 },
  { key: 'all', label: 'All', days: null },
  { key: 'custom', label: 'Custom', days: null },
];

// the lines one metric draws, oldest → newest, each point { ts, v }
export function seriesFor(data, metric) {
  const asc = arr => [...arr].sort((a, b) => a.ts - b.ts);
  switch (metric) {
    case 'bp': {
      const rows = asc(data.bp || []);
      return [
        { key: 'sys', label: 'Systolic', color: '#EA580C', points: rows.map(r => ({ ts: r.ts, v: r.sys })) },
        { key: 'dia', label: 'Diastolic', color: '#22C55E', points: rows.map(r => ({ ts: r.ts, v: r.dia })) },
      ];
    }
    case 'pulse':
      return [{ key: 'pulse', label: 'Heart rate', color: '#E11D48', points: asc((data.bp || []).filter(r => r.pulse)).map(r => ({ ts: r.ts, v: r.pulse })) }];
    case 'sugar': {
      const rows = asc(data.sugar || []);
      return [
        { key: 'fasting', label: 'Fasting', color: '#3B82F6', points: rows.filter(r => r.kind === 'fasting').map(r => ({ ts: r.ts, v: r.mgdl })) },
        { key: 'post', label: 'After meal', color: '#D97706', points: rows.filter(r => r.kind !== 'fasting').map(r => ({ ts: r.ts, v: r.mgdl })) },
      ];
    }
    case 'weight':
      return [{ key: 'weight', label: 'Weight', color: '#16A34A', points: asc(data.body || []).map(r => ({ ts: r.ts, v: r.weightKg })) }];
    default:
      return [];
  }
}

/* { from, to } in ms for a range key. `custom` carries its own dates;
   `all` starts at the earliest reading. */
export function windowFor(rangeKey, custom, series) {
  const to = rangeKey === 'custom' && custom?.to ? endOfDay(custom.to) : Date.now();
  if (rangeKey === 'custom' && custom?.from) return { from: startOfDay(custom.from), to };
  const r = RANGES.find(x => x.key === rangeKey);
  if (r?.days) return { from: to - r.days * DAY, to };
  const first = Math.min(...series.flatMap(s => s.points.map(p => p.ts)), to);
  return { from: first, to };
}

export const spanDays = ({ from, to }) => Math.max(1, Math.round((to - from) / DAY));

export const clip = (series, { from, to }) => series.map(s => ({ ...s, points: s.points.filter(p => p.ts >= from && p.ts <= to) }));

const round1 = v => Math.round(v * 10) / 10;

export function stats(points) {
  if (!points.length) return null;
  const vs = points.map(p => p.v);
  const sum = vs.reduce((a, b) => a + b, 0);
  return {
    count: vs.length,
    mean: round1(sum / vs.length),
    min: Math.min(...vs),
    max: Math.max(...vs),
    first: vs[0],
    last: vs[vs.length - 1],
    change: round1(vs[vs.length - 1] - vs[0]),
  };
}

// the same series over the equally long period just before this window
export function previousWindow({ from, to }) {
  const len = to - from;
  return { from: from - len, to: from };
}

export function toCsv(metric, series, window) {
  const m = METRICS.find(x => x.key === metric);
  const byTs = new Map();
  for (const s of series) for (const p of s.points) byTs.set(p.ts, { ...(byTs.get(p.ts) || {}), [s.label]: p.v });
  const cols = series.map(s => s.label);
  const lines = [`# ${m.label} (${m.unit}), ${fmt(window.from)} to ${fmt(window.to)} — exported from MyHealthBook`, ['Date', 'Time', ...cols].join(',')];
  [...byTs.entries()]
    .sort((a, b) => a[0] - b[0])
    .forEach(([ts, row]) => {
      const d = new Date(ts);
      lines.push([d.toISOString().slice(0, 10), d.toTimeString().slice(0, 5), ...cols.map(c => row[c] ?? '')].join(','));
    });
  return lines.join('\n');
}

export const fmt = ts => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(ts) {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
