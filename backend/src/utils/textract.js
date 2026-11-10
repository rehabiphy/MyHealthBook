import { TextractClient, StartDocumentAnalysisCommand, GetDocumentAnalysisCommand } from '@aws-sdk/client-textract';

/* Amazon Textract scans an uploaded report straight from S3 and returns
   its printed text, tables (lab results, bill items) and form fields
   (Name: …, Date: …). The report reader passes that to the AI next to
   the file itself, so numbers in dense tables are copied exactly.

   Turned on with TEXTRACT_ENABLED=true. Any failure here is non-fatal:
   the AI still reads the file on its own.

   IAM: textract:StartDocumentAnalysis + textract:GetDocumentAnalysis, and
   s3:GetObject on the bucket (Textract reads the file with the caller's
   permissions). The bucket must be in AWS_REGION. */

// Textract reads JPEG, PNG, PDF and TIFF — not WEBP or HEIC
const SUPPORTED = ['application/pdf', 'image/jpeg', 'image/png'];
const POLL_MS = 2000;
const TIMEOUT_MS = 3 * 60 * 1000;
const MAX_TEXT = 12000;

export const textractEnabled = () => process.env.TEXTRACT_ENABLED === 'true' && Boolean(process.env.S3_BUCKET && process.env.AWS_REGION);
export const textractSupports = type => SUPPORTED.includes(type);

let client = null;
const textract = () => (client ||= new TextractClient({ region: process.env.AWS_REGION }));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function analyze(key) {
  const { JobId } = await textract().send(
    new StartDocumentAnalysisCommand({
      DocumentLocation: { S3Object: { Bucket: process.env.S3_BUCKET, Name: key } },
      FeatureTypes: ['TABLES', 'FORMS'],
    }),
  );

  const started = Date.now();
  for (;;) {
    await sleep(POLL_MS);
    const first = await textract().send(new GetDocumentAnalysisCommand({ JobId }));
    if (first.JobStatus === 'FAILED') throw new Error(first.StatusMessage || 'Textract job failed');
    if (first.JobStatus === 'SUCCEEDED' || first.JobStatus === 'PARTIAL_SUCCESS') {
      const blocks = [...(first.Blocks || [])];
      let next = first.NextToken;
      while (next) {
        const page = await textract().send(new GetDocumentAnalysisCommand({ JobId, NextToken: next }));
        blocks.push(...(page.Blocks || []));
        next = page.NextToken;
      }
      return blocks;
    }
    if (Date.now() - started > TIMEOUT_MS) throw new Error('Textract timed out');
  }
}

/* Blocks → plain text: the page lines, then each table as "a | b | c"
   rows, then form fields as "key: value". */
function toText(blocks) {
  const byId = new Map(blocks.map(b => [b.Id, b]));
  const kids = (b, type = 'CHILD') => (b.Relationships || []).filter(r => r.Type === type).flatMap(r => r.Ids.map(id => byId.get(id)).filter(Boolean));
  const words = b =>
    kids(b)
      .map(c => (c.BlockType === 'WORD' ? c.Text : c.BlockType === 'SELECTION_ELEMENT' && c.SelectionStatus === 'SELECTED' ? '[x]' : ''))
      .filter(Boolean)
      .join(' ');

  const out = [];
  const lines = blocks.filter(b => b.BlockType === 'LINE').map(b => b.Text);
  if (lines.length) out.push('TEXT:', ...lines);

  blocks
    .filter(b => b.BlockType === 'TABLE')
    .forEach((table, i) => {
      const rows = [];
      for (const cell of kids(table).filter(c => c.BlockType === 'CELL')) {
        (rows[cell.RowIndex - 1] ||= [])[cell.ColumnIndex - 1] = words(cell);
      }
      out.push('', `TABLE ${i + 1}:`, ...rows.filter(Boolean).map(r => Array.from(r, c => c || '').join(' | ')));
    });

  const fields = blocks
    .filter(b => b.BlockType === 'KEY_VALUE_SET' && b.EntityTypes?.includes('KEY'))
    .map(k => {
      const value = kids(k, 'VALUE')[0];
      return `${words(k)}: ${value ? words(value) : ''}`.trim();
    })
    .filter(f => f.length > 1);
  if (fields.length) out.push('', 'FIELDS:', ...fields);

  return out.join('\n').slice(0, MAX_TEXT);
}

/** The scanned text of one S3 file, or '' if Textract is off, can't read this type, or fails. */
export async function scanDocument(key, type) {
  if (!textractEnabled() || !textractSupports(type)) return '';
  try {
    return toText(await analyze(key));
  } catch (err) {
    console.warn('Textract scan failed for', key, '—', err.message);
    return '';
  }
}
