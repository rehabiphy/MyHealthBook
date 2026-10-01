import { C } from '../theme/colors';

/* The kinds of record. A report is what a test produces, a hospital
   stay is where a procedure happens, and a visit is where a treatment
   is decided — so those folded in rather than standing alone.
   Prescriptions and bills are their own kinds: they're the papers people
   most often keep, and look for again. */
export const HISTORY_TYPES = [
  { key: 'test', label: 'Test or scan', blurb: 'Blood test, X-ray, MRI, or any report', color: C.low },
  { key: 'prescription', label: 'Prescription', blurb: 'Medicines a doctor wrote down for you', color: C.brand },
  // no longer offered for new records — kept so records already saved as these still show and open correctly
  { key: 'diagnosis', label: 'Diagnosis', blurb: 'A condition your doctor found', color: C.stage2, retired: true },
  { key: 'treatment', label: 'Treatment or medicine', blurb: 'A therapy or doctor visit', color: C.brand, retired: true },
  { key: 'procedure', label: 'Procedure or surgery', blurb: 'An operation, or a stay in hospital', color: C.elevated },
  { key: 'bill', label: 'Bill', blurb: 'Hospital, doctor, lab or pharmacy bill', color: C.stage1 },
  { key: 'other', label: 'Something else', blurb: 'Any other note worth keeping', color: C.ink2 },
];

// what "Add a record" offers
export const ADDABLE_TYPES = HISTORY_TYPES.filter(t => !t.retired);
export const RETIRED_TYPES = HISTORY_TYPES.filter(t => t.retired).map(t => t.key);

/* Records saved under the old eight-way split still open correctly. */
export const LEGACY_TYPE = { report: 'test', hospital: 'procedure', visit: 'treatment', note: 'other' };
export const normType = k => LEGACY_TYPE[k] || k;
export const typeOf = k => HISTORY_TYPES.find(t => t.key === normType(k)) || HISTORY_TYPES.find(t => t.key === 'other');

export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'test', label: 'Tests' },
  { key: 'prescription', label: 'Prescriptions' },
  { key: 'bill', label: 'Bills' },
  { key: 'diagnosis', label: 'Diagnoses' },
  { key: 'treatment', label: 'Treatments' },
  { key: 'procedure', label: 'Procedures' },
  { key: 'other', label: 'Other' },
];

// ₹1,250 / ₹1,250.50 — a bill's total as people read it
export const rupees = n => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const monthLabel = ts => new Date(ts).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
