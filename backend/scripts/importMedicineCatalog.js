/* Loads meds_datasets/DATA/updated_indian_medicine_data.csv into the
   medicine_catalog collection. Safe to re-run: it replaces the whole
   collection each time.

     npm run import:meds                  # default dataset path
     npm run import:meds -- path/to.csv   # a different CSV, same columns */
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import MedicineCatalog, { indexWords } from '../src/models/MedicineCatalog.js';
import { readCsv } from './lib/csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2] || path.resolve(here, '../../meds_datasets/DATA/updated_indian_medicine_data.csv');
const BATCH = 5000;

const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

function toDoc(r) {
  const name = clean(r.name);
  if (!name) return null;
  const composition = clean(r.salt_composition) || [clean(r.short_composition1), clean(r.short_composition2)].filter(Boolean).join(' + ');
  const price = parseFloat(r.price ?? r['price(₹)']);
  return {
    srcId: Number(r.id),
    name,
    nameLower: name.toLowerCase(),
    words: indexWords(name, composition),
    manufacturer: clean(r.manufacturer_name),
    packSize: clean(r.pack_size_label),
    composition,
    price: Number.isFinite(price) ? price : null,
    discontinued: String(r.Is_discontinued).toUpperCase() === 'TRUE',
  };
}

await connectDB();
console.log(`Importing ${csvPath}`);

await MedicineCatalog.collection.drop().catch(() => {}); // absent on first run
await MedicineCatalog.createCollection();

let batch = [];
let total = 0;
const flush = async () => {
  if (!batch.length) return;
  await MedicineCatalog.collection.insertMany(batch, { ordered: false });
  total += batch.length;
  batch = [];
  process.stdout.write(`\r  ${total} medicines`);
};

for await (const row of readCsv(csvPath)) {
  const doc = toDoc(row);
  if (doc) batch.push(doc);
  if (batch.length >= BATCH) await flush();
}
await flush();

console.log('\nBuilding indexes…');
await MedicineCatalog.syncIndexes();
console.log(`Done — ${total} medicines in medicine_catalog`);
await mongoose.disconnect();
