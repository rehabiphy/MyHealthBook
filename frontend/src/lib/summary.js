import { classifyBP, fmtTime } from './calc';
import { activeMeds, prettyTime, slotOf } from './meds';
import { normType, typeOf } from './history';

/* The Health Summary, built only from what's stored in the user's own
   record — nothing inferred, nothing invented. Sections with no data
   say so plainly instead of being filled in. */

const DAY = 864e5;
const fmtDate = ts => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const esc = s =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const upcomingOf = data =>
  (data.health?.upcoming || [])
    .filter(u => u && u.date >= Date.now() - DAY)
    .sort((a, b) => a.date - b.date);

// tests / scans, newest first
export const recentInvestigations = (data, n = 5) =>
  (data.history || [])
    .filter(r => normType(r.type) === 'test')
    .sort((a, b) => b.date - a.date)
    .slice(0, n);

// the history that matters most to a doctor: diagnoses and procedures
const importantHistory = (data, n = 12) =>
  (data.history || [])
    .filter(r => ['diagnosis', 'procedure'].includes(normType(r.type)))
    .sort((a, b) => b.date - a.date)
    .slice(0, n);

const medWhen = (data, m) => m.slots.map(k => `${slotOf(k).label} ${prettyTime((data.medSettings?.times || {})[k] || slotOf(k).time)}`).join(', ');

function recentReadings(data) {
  const since = Date.now() - 30 * DAY;
  const bp = (data.bp || []).filter(r => r.ts >= since);
  const sugar = (data.sugar || []).filter(r => r.ts >= since);
  const body = (data.body || []).filter(r => r.ts >= since);
  const mean = a => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
  const rows = [];
  if (data.bp?.[0]) rows.push(['Blood pressure, latest', `${data.bp[0].sys}/${data.bp[0].dia} mmHg${data.bp[0].pulse ? `, pulse ${data.bp[0].pulse}` : ''} — ${fmtDate(data.bp[0].ts)} ${fmtTime(data.bp[0].ts)}`]);
  if (bp.length) rows.push(['Blood pressure, 30-day average', `${mean(bp.map(r => r.sys))}/${mean(bp.map(r => r.dia))} mmHg (${bp.length} readings)`]);
  const f = sugar.filter(r => r.kind === 'fasting');
  const pm = sugar.filter(r => r.kind !== 'fasting');
  if (f.length) rows.push(['Fasting glucose, 30-day average', `${mean(f.map(r => r.mgdl))} mg/dL (${f.length} readings)`]);
  if (pm.length) rows.push(['After-meal glucose, 30-day average', `${mean(pm.map(r => r.mgdl))} mg/dL (${pm.length} readings)`]);
  if (data.body?.[0]) rows.push(['Weight, latest', `${data.body[0].weightKg} kg — ${fmtDate(data.body[0].ts)}${body.length > 1 ? ` (${body.length} entries in 30 days)` : ''}`]);
  return rows;
}

/* The doctor-ready summary as a printable page, turned into a PDF by
   lib/share.js shareReportPdf. */
export function buildSummaryHTML(data) {
  const p = data.profile || {};
  const h = data.health || {};
  const meds = activeMeds(data);
  const tests = recentInvestigations(data, 8);
  const hist = importantHistory(data);
  const readings = recentReadings(data);
  const upcoming = upcomingOf(data);
  const row = (k, v) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
  const none = t => `<p class="none">${esc(t)}</p>`;

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Health Summary${p.name ? ` — ${esc(p.name)}` : ''}</title>
<style>
  @page { margin: 16mm; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111; margin: 0; font-size: 12px; line-height: 1.55; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
  h2 { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin: 20px 0 8px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-weight: 500; color: #666; width: 36%; padding: 3px 8px 3px 0; vertical-align: top; }
  td { padding: 3px 0; font-weight: 600; vertical-align: top; }
  table.list th, table.list td { font-weight: 500; color: #111; padding: 5px 8px 5px 0; border-bottom: 1px solid #eee; width: auto; }
  table.list thead th { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: #888; border-bottom: 1px solid #bbb; }
  .allergy { color: #B42318; }
  .none { color: #777; margin: 2px 0; }
  .foot { margin-top: 24px; padding-top: 10px; border-top: 1px solid #ccc; color: #666; font-size: 10px; }
</style></head><body>
<h1>Health Summary${p.name ? ` — ${esc(p.name)}` : ''}</h1>
<div class="meta">Prepared ${esc(new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }))} from the patient's own MyHealthBook record</div>

<h2>Patient overview</h2>
<table>
  ${row('Name', p.name || '—')}
  ${row('Age', p.age ? `${p.age} years` : '—')}
  ${row('Sex', p.sex ? p.sex.charAt(0).toUpperCase() + p.sex.slice(1) : '—')}
  ${row('Blood group', h.bloodGroup || 'Not recorded')}
  <tr><th>Allergies</th><td class="${h.allergies ? 'allergy' : ''}">${esc(h.allergies || 'No known allergies recorded')}</td></tr>
  ${row('Important conditions', (h.conditions || []).join(', ') || 'None recorded')}
</table>

<h2>Important medical history</h2>
${hist.length ? `<table class="list"><thead><tr><th>Date</th><th>Type</th><th>Details</th></tr></thead><tbody>
${hist.map(r => `<tr><td>${esc(fmtDate(r.date))}</td><td>${esc(typeOf(r.type).label)}</td><td>${esc(r.title)}${r.details ? ` — ${esc(r.details)}` : ''}${r.doctor ? `<br><span style="color:#666">${esc(r.doctor)}${r.hospital ? `, ${esc(r.hospital)}` : ''}</span>` : ''}</td></tr>`).join('')}
</tbody></table>` : none('No diagnoses or procedures recorded.')}

<h2>Current medications</h2>
${meds.length ? `<table class="list"><thead><tr><th>Medicine</th><th>Dose</th><th>When</th></tr></thead><tbody>
${meds.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.dose || '—')}</td><td>${esc(medWhen(data, m))}</td></tr>`).join('')}
</tbody></table><p class="none">Patient-entered list, not verified against a prescription.</p>` : none('No current medicines recorded.')}

<h2>Recent investigations</h2>
${tests.length ? `<table class="list"><thead><tr><th>Date</th><th>Test</th><th>Result noted</th></tr></thead><tbody>
${tests.map(r => `<tr><td>${esc(fmtDate(r.date))}</td><td>${esc(r.title)}${r.hospital ? `<br><span style="color:#666">${esc(r.hospital)}</span>` : ''}</td><td>${esc(r.details || '—')}</td></tr>`).join('')}
</tbody></table>` : none('No tests or scans recorded.')}

<h2>Recent health readings</h2>
${readings.length ? `<table>${readings.map(([k, v]) => row(k, v)).join('')}</table>
${data.bp?.[0] ? `<p class="none">Latest blood pressure falls in the ACC/AHA 2017 “${esc(classifyBP(data.bp[0].sys, data.bp[0].dia).label)}” reference band. Self-measured at home.</p>` : ''}` : none('No readings recorded.')}

<h2>Upcoming follow-ups</h2>
${upcoming.length ? `<table class="list"><thead><tr><th>Date</th><th>What</th><th>With</th></tr></thead><tbody>
${upcoming.map(u => `<tr><td>${esc(fmtDate(u.date))}</td><td>${esc(u.title)}</td><td>${esc([u.doctor, u.place].filter(Boolean).join(', ') || '—')}</td></tr>`).join('')}
</tbody></table>` : none('No follow-ups recorded.')}

<div class="foot">This summary is compiled from information the patient entered into MyHealthBook. It is a record, not a diagnosis, and has not been verified by a clinician.</div>
</body></html>`;
}

// a short plain-text version for WhatsApp / email
export function buildSummaryText(data) {
  const p = data.profile || {};
  const h = data.health || {};
  const L = [`Health Summary${p.name ? ` — ${p.name}` : ''}`, ''];
  L.push(`Age ${p.age || '—'} · Blood group ${h.bloodGroup || '—'}`);
  L.push(`Allergies: ${h.allergies || 'none recorded'}`);
  if (h.conditions?.length) L.push(`Conditions: ${h.conditions.join(', ')}`);
  const meds = activeMeds(data);
  if (meds.length) {
    L.push('', 'Current medicines');
    meds.forEach(m => L.push(`• ${m.name}${m.dose ? ` ${m.dose}` : ''} — ${medWhen(data, m)}`));
  }
  const rs = recentReadings(data);
  if (rs.length) {
    L.push('', 'Recent readings');
    rs.forEach(([k, v]) => L.push(`• ${k}: ${v}`));
  }
  const up = upcomingOf(data);
  if (up.length) {
    L.push('', 'Upcoming');
    up.forEach(u => L.push(`• ${fmtDate(u.date)} — ${u.title}${u.doctor ? ` (${u.doctor})` : ''}`));
  }
  L.push('', 'From my MyHealthBook record — not a diagnosis.');
  return L.join('\n');
}
