/* Copies the medicine_catalog collection (MongoDB) into the OpenSearch
   "medicines" index. Safe to re-run: it rebuilds the index from scratch.
   Run on the server (the OpenSearch domain is only reachable from inside
   the VPC), after OPENSEARCH_ENDPOINT is set in .env:

     npm run index:meds            # rebuild the index
     npm run index:meds -- --check # only test the connection and show the index size */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import MedicineCatalog from '../src/models/MedicineCatalog.js';
import { opensearch, MEDICINE_INDEX, MEDICINE_INDEX_BODY } from '../src/utils/search.js';

const BATCH = 2000;

if (!process.env.OPENSEARCH_ENDPOINT) {
  console.error('Set OPENSEARCH_ENDPOINT in .env first (the domain\'s "VPC endpoint" address).');
  process.exit(1);
}

const os = opensearch();

async function check() {
  const { body: info } = await os.info();
  console.log(`Connected: OpenSearch ${info.version?.number} (${info.cluster_name})`);
  const { body: exists } = await os.indices.exists({ index: MEDICINE_INDEX });
  if (!exists) return console.log(`Index "${MEDICINE_INDEX}" doesn't exist yet. Run: npm run index:meds`);
  const { body: count } = await os.count({ index: MEDICINE_INDEX });
  console.log(`Index "${MEDICINE_INDEX}" has ${count.count} medicines.`);
}

async function rebuild() {
  await connectDB();
  const total = await MedicineCatalog.estimatedDocumentCount();
  if (!total) throw new Error('medicine_catalog is empty — run npm run import:meds first');

  const { body: exists } = await os.indices.exists({ index: MEDICINE_INDEX });
  if (exists) {
    await os.indices.delete({ index: MEDICINE_INDEX });
    console.log('Deleted the old index.');
  }
  await os.indices.create({ index: MEDICINE_INDEX, body: MEDICINE_INDEX_BODY });
  // no refreshes while loading — much faster; turned back on at the end
  await os.indices.putSettings({ index: MEDICINE_INDEX, body: { index: { refresh_interval: '-1' } } });
  console.log(`Indexing ${total} medicines …`);

  const cursor = MedicineCatalog.find({}, { name: 1, composition: 1, manufacturer: 1, packSize: 1, price: 1, discontinued: 1 }).lean().cursor({ batchSize: BATCH });
  let batch = [];
  let done = 0;
  let failed = 0;

  const flush = async () => {
    if (!batch.length) return;
    const { body } = await os.bulk({ body: batch.flatMap(d => [{ index: { _index: MEDICINE_INDEX, _id: String(d._id) } }, toDoc(d)]) });
    if (body.errors) {
      const bad = body.items.filter(i => i.index?.error);
      failed += bad.length;
      if (failed === bad.length) console.warn('First failure:', JSON.stringify(bad[0].index.error));
    }
    done += batch.length;
    batch = [];
    process.stdout.write(`\r  ${done} / ${total}`);
  };

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  process.stdout.write('\n');

  await os.indices.putSettings({ index: MEDICINE_INDEX, body: { index: { refresh_interval: '1s' } } });
  await os.indices.refresh({ index: MEDICINE_INDEX });
  const { body: count } = await os.count({ index: MEDICINE_INDEX });
  console.log(`Done: ${count.count} medicines in the index${failed ? `, ${failed} failed` : ''}.`);
}

const toDoc = d => ({
  name: d.name,
  composition: d.composition || '',
  manufacturer: d.manufacturer || '',
  packSize: d.packSize || '',
  price: d.price ?? null,
  discontinued: Boolean(d.discontinued),
});

try {
  if (process.argv.includes('--check')) await check();
  else await rebuild();
} catch (err) {
  console.error('\nFailed:', err.meta?.statusCode || '', err.message);
  if (err.meta?.body) console.error(JSON.stringify(err.meta.body).slice(0, 500));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
