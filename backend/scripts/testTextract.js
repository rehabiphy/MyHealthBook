import 'dotenv/config';
import { scanDocument, textractSupports } from '../src/utils/textract.js';

/* Scans one file already in the S3 bucket with Amazon Textract and
   prints what it read. Use a sample/dummy report, not a real user's.

   Usage (from backend/):
     npm run test:textract -- <s3-key>
     e.g. npm run test:textract -- test/sample-lab-report.pdf

   Works even if TEXTRACT_ENABLED is off in .env. Costs about $0.065 per page. */

const key = process.argv[2];
if (!key) {
  console.error('Give the S3 key of a sample report, e.g.: npm run test:textract -- test/sample-lab-report.pdf');
  process.exit(1);
}
if (!process.env.S3_BUCKET || !process.env.AWS_REGION) {
  console.error('S3_BUCKET and AWS_REGION must be set in .env');
  process.exit(1);
}

const ext = key.split('.').pop().toLowerCase();
const type = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }[ext];
if (!type || !textractSupports(type)) {
  console.error('Textract reads PDF, JPG and PNG files only.');
  process.exit(1);
}

process.env.TEXTRACT_ENABLED = 'true';
console.log(`Scanning s3://${process.env.S3_BUCKET}/${key} in ${process.env.AWS_REGION} …`);
const started = Date.now();
const text = await scanDocument(key, type);
if (!text) {
  console.error('No text came back. The warning line above (if any) shows why.');
  process.exit(1);
}
console.log(`\n${text}\n`);
console.log(`Done in ${Math.round((Date.now() - started) / 1000)} s, ${text.length} characters.`);
