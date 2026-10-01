import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';
import { resumeSosTimers } from './controllers/sosController.js';
import { startHealthTips } from './jobs/healthTips.js';
import { startSubscriptionJobs } from './jobs/subscriptions.js';
import { startDocumentReader } from './jobs/documentReader.js';

const PORT = process.env.PORT || 8000;

await connectDB();
await resumeSosTimers();
startHealthTips();
startSubscriptionJobs();
startDocumentReader();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MyHealthBook API listening on :${PORT}`);
});
