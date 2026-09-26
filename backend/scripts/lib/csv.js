import fs from 'fs';

/* Streaming RFC-4180 CSV reader — handles quoted fields containing
   commas, newlines and "" escapes (the medicine dataset's description
   and interaction columns have all three). Yields one object per row,
   keyed by the header line. */
export async function* readCsv(path) {
  const stream = fs.createReadStream(path, { encoding: 'utf8' });
  let header = null;
  let row = [];
  let field = '';
  let inQuotes = false;
  let pendingQuote = false; // saw a `"` inside quotes; next char decides escape vs close

  const endRow = () => {
    row.push(field);
    field = '';
    const r = row;
    row = [];
    if (!header) {
      header = r.map(h => h.replace(/^﻿/, '').trim());
      return null;
    }
    if (r.length === 1 && r[0] === '') return null; // blank line
    return Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']));
  };

  for await (const chunk of stream) {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
      if (pendingQuote) {
        pendingQuote = false;
        if (ch === '"') {
          field += '"';
          continue;
        }
        inQuotes = false;
      }
      if (inQuotes) {
        if (ch === '"') pendingQuote = true;
        else field += ch;
        continue;
      }
      if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        const out = endRow();
        if (out) yield out;
      } else if (ch !== '\r') field += ch;
    }
  }
  if (field !== '' || row.length) {
    const out = endRow();
    if (out) yield out;
  }
}
