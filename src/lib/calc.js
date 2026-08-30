import { C } from '../theme/colors';

export const uid = () => Math.random().toString(36).slice(2, 10);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

export const fmtDay = ts => {
  if (sameDay(ts, Date.now())) return 'TODAY';
  if (sameDay(ts, Date.now() - 864e5)) return 'YESTERDAY';
  return new Date(ts).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }).toUpperCase();
};

export const fmtTime = ts =>
  new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

export function classifyBP(sys, dia) {
  if (sys > 180 || dia > 120) return { k: 'crisis', label: 'Crisis range', color: C.crisis, note: 'Get medical help now' };
  if (sys < 90 || dia < 60) return { k: 'low', label: 'Low', color: C.low, note: 'Below the usual range' };
  if (sys >= 140 || dia >= 90) return { k: 'stage2', label: 'High · stage 2', color: C.stage2, note: "Worth a doctor's review" };
  if (sys >= 130 || dia >= 80) return { k: 'stage1', label: 'High · stage 1', color: C.stage1, note: 'Above target' };
  if (sys >= 120) return { k: 'elevated', label: 'Elevated', color: C.elevated, note: 'Slightly above ideal' };
  return { k: 'normal', label: 'In range', color: C.normal, note: 'Healthy reading' };
}

export function classifyBMI(b) {
  if (!b) return null;
  if (b < 18.5) return { label: 'Underweight', color: C.low };
  if (b < 23) return { label: 'In range', color: C.normal };
  if (b < 25) return { label: 'Overweight', color: C.elevated };
  if (b < 30) return { label: 'Obese I', color: C.stage1 };
  return { label: 'Obese II', color: C.stage2 };
}

export function classifySugar(v, kind) {
  if (v < 70) return { label: 'Low', color: C.low };
  if (kind === 'fasting') {
    if (v < 100) return { label: 'In range', color: C.normal };
    if (v < 126) return { label: 'Pre-diabetes range', color: C.elevated };
    return { label: 'Diabetes range', color: C.stage2 };
  }
  if (v < 140) return { label: 'In range', color: C.normal };
  if (v < 200) return { label: 'Pre-diabetes range', color: C.elevated };
  return { label: 'Diabetes range', color: C.stage2 };
}

export const kg1 = v => (v == null || isNaN(+v) ? '—' : Number(v).toFixed(1));

export const bmiOf = (kg, cm) => (kg && cm ? +(kg / Math.pow(cm / 100, 2)).toFixed(1) : null);

export const BANDS = [
  { from: 80, to: 90, color: C.low },
  { from: 90, to: 120, color: C.normal },
  { from: 120, to: 130, color: C.elevated },
  { from: 130, to: 140, color: C.stage1 },
  { from: 140, to: 180, color: C.stage2 },
];

export const BMI_BANDS = [
  { from: 14, to: 18.5, color: C.low },
  { from: 18.5, to: 23, color: C.normal },
  { from: 23, to: 25, color: C.elevated },
  { from: 25, to: 30, color: C.stage1 },
  { from: 30, to: 40, color: C.stage2 },
];
