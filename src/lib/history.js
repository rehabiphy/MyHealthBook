import { C } from '../theme/colors';

/* Five kinds, not eight. A report is what a test produces, a hospital
   stay is where a procedure happens, and a visit is where a treatment
   is decided — so those folded in rather than standing alone. */
export const HISTORY_TYPES = [
  { key: 'test', label: 'Test or scan', blurb: 'Blood test, X-ray, MRI, or any report', color: C.low },
  { key: 'diagnosis', label: 'Diagnosis', blurb: 'A condition your doctor found', color: C.stage2 },
  { key: 'treatment', label: 'Treatment or medicine', blurb: 'A prescription, therapy or doctor visit', color: C.brand },
  { key: 'procedure', label: 'Procedure or surgery', blurb: 'An operation, or a stay in hospital', color: C.elevated },
  { key: 'other', label: 'Something else', blurb: 'Any other note worth keeping', color: C.ink2 },
];

/* Records saved under the old eight-way split still open correctly. */
export const LEGACY_TYPE = { report: 'test', hospital: 'procedure', visit: 'treatment', note: 'other' };
export const normType = k => LEGACY_TYPE[k] || k;
export const typeOf = k => HISTORY_TYPES.find(t => t.key === normType(k)) || HISTORY_TYPES[4];

export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'test', label: 'Tests' },
  { key: 'diagnosis', label: 'Diagnoses' },
  { key: 'treatment', label: 'Treatments' },
  { key: 'procedure', label: 'Procedures' },
  { key: 'other', label: 'Other' },
];

export const monthLabel = ts => new Date(ts).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
