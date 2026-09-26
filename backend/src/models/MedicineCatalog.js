import mongoose from 'mongoose';

/* Read-only reference list of Indian medicines (meds_datasets/, ~254k
   rows), loaded by scripts/importMedicineCatalog.js. Powers the
   searchable name picker when adding a medicine — not per-user data. */
const medicineCatalogSchema = new mongoose.Schema(
  {
    srcId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    nameLower: { type: String, required: true },
    // lowercase word tokens from name + composition; search matches each query word as a prefix
    words: { type: [String], default: [] },
    manufacturer: { type: String, default: '' },
    packSize: { type: String, default: '' },
    composition: { type: String, default: '' },
    price: { type: Number, default: null },
    discontinued: { type: Boolean, default: false },
  },
  { collection: 'medicine_catalog', versionKey: false },
);

medicineCatalogSchema.index({ nameLower: 1, _id: 1 });
medicineCatalogSchema.index({ words: 1 });

export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9.%]+/)
    .map(w => w.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);
}

/* Index-side tokens: also splits letter/digit runs ("500mg" -> "500",
   "mg") so a query typed as "500 mg" still finds it. */
export function indexWords(...texts) {
  const out = new Set();
  for (const w of tokenize(texts.join(' '))) {
    out.add(w);
    const parts = w.match(/[a-z]+|[0-9.]+%?/g) || [];
    if (parts.length > 1) parts.forEach(p => out.add(p));
  }
  return [...out];
}

export default mongoose.model('MedicineCatalog', medicineCatalogSchema);
