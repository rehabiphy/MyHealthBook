import { bmiOf, classifyBMI, classifyBP, classifySugar, fmtDay, fmtTime, kg1 } from './calc';
import { adherence, prettyTime, slotOf } from './meds';

export const avg = a => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
export const within = (ts, days) => Date.now() - ts <= days * 864e5;

export function buildReport(data) {
  const p = data.profile;
  const L = [];
  const pad = (s, n) => String(s).padEnd(n);
  const wNow = data.body[0]?.weightKg;
  const bmiNow = bmiOf(wNow, p.heightCm);

  L.push(`VITALS REPORT${p.name ? ` — ${p.name.toUpperCase()}` : ''}`);
  L.push(`Generated ${new Date().toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  L.push('');
  L.push('PATIENT');
  L.push(`Name         ${p.name || '—'}`);
  L.push(`Age          ${p.age ? `${p.age} years` : '—'}`);
  L.push(`Sex          ${p.sex ? p.sex.charAt(0).toUpperCase() + p.sex.slice(1) : '—'}`);
  L.push(`Height       ${p.heightCm ? `${p.heightCm} cm` : '—'}`);
  L.push(`Weight       ${wNow ? `${kg1(wNow)} kg` : '—'}`);
  L.push(`BMI          ${bmiNow ? `${bmiNow}   ${classifyBMI(bmiNow).label}` : '—'}`);
  L.push(`Diet         ${p.diet === 'veg' ? 'Vegetarian' : p.diet === 'egg' ? 'Eggetarian' : 'Non-vegetarian'}`);
  L.push('');

  const bp = data.bp;
  L.push(`BLOOD PRESSURE — ${bp.length} reading${bp.length === 1 ? '' : 's'}`);
  if (bp.length) {
    const last = bp[0];
    const w7 = bp.filter(r => within(r.ts, 7));
    const w30 = bp.filter(r => within(r.ts, 30));
    const inRange = bp.filter(r => classifyBP(r.sys, r.dia).k === 'normal').length;
    L.push(`Latest       ${last.sys}/${last.dia} mmHg   ${classifyBP(last.sys, last.dia).label}   ${fmtDay(last.ts)} ${fmtTime(last.ts)}`);
    if (w7.length) L.push(`7-day mean   ${avg(w7.map(r => r.sys))}/${avg(w7.map(r => r.dia))} mmHg   (${w7.length} readings)`);
    if (w30.length) L.push(`30-day mean  ${avg(w30.map(r => r.sys))}/${avg(w30.map(r => r.dia))} mmHg   (${w30.length} readings)`);
    L.push(`Spread       ${Math.min(...bp.map(r => r.sys))}–${Math.max(...bp.map(r => r.sys))} / ${Math.min(...bp.map(r => r.dia))}–${Math.max(...bp.map(r => r.dia))} mmHg`);
    L.push(`In range     ${inRange} of ${bp.length}`);
  } else L.push('No readings recorded.');
  L.push('');

  const b = data.body;
  L.push('BODY');
  if (b.length) {
    const bmi = bmiOf(b[0].weightKg, p.heightCm);
    L.push(`Latest       ${kg1(b[0].weightKg)} kg${bmi ? `   BMI ${bmi}   ${classifyBMI(bmi).label}` : ''}`);
    if (b.length > 1) {
      const d = +(b[0].weightKg - b[b.length - 1].weightKg).toFixed(1);
      L.push(`Change       ${d > 0 ? '+' : ''}${d} kg over ${b.length} entries`);
    }
    L.push('BMI read on WHO Asia-Pacific cut-offs (healthy 18.5–22.9).');
  } else L.push('No entries recorded.');
  L.push('');

  const s = data.sugar;
  L.push('BLOOD SUGAR');
  if (s.length) {
    const f = s.filter(r => r.kind === 'fasting'),
      pm = s.filter(r => r.kind === 'post');
    if (f.length) L.push(`Fasting      mean ${avg(f.map(r => r.mgdl))} mg/dL   latest ${f[0].mgdl}   (${f.length})`);
    if (pm.length) L.push(`After meal   mean ${avg(pm.map(r => r.mgdl))} mg/dL   latest ${pm[0].mgdl}   (${pm.length})`);
  } else L.push('No readings recorded.');
  L.push('');

  if (data.meds.length) {
    const t = data.medSettings?.times || {};
    const ad = adherence(data, 7);
    L.push('MEDICATIONS');
    data.meds.forEach(m => {
      const when = m.slots.map(k => `${slotOf(k).label} ${prettyTime(t[k] || slotOf(k).time)}`).join(', ');
      L.push(`${m.name}${m.dose ? ` — ${m.dose}` : ''}`);
      L.push(`   ${when}`);
    });
    if (ad.pct != null) L.push(`Doses taken as scheduled, last 7 days: ${ad.done} of ${ad.due} (${ad.pct}%)`);
    L.push('Patient-entered list. Not verified against a prescription.');
    L.push('');
  }

  if (bp.length) {
    L.push('PRESSURE LOG');
    L.push(`${pad('DATE', 11)}${pad('TIME', 7)}${pad('SYS/DIA', 10)}${pad('PULSE', 7)}CATEGORY`);
    bp.slice(0, 30).forEach(r => {
      L.push(
        pad(new Date(r.ts).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }), 11) +
          pad(fmtTime(r.ts), 7) +
          pad(`${r.sys}/${r.dia}`, 10) +
          pad(r.pulse || '—', 7) +
          classifyBP(r.sys, r.dia).label,
      );
    });
    L.push('');
  }

  L.push('Measured at home by the patient. Reference ranges follow ACC/AHA 2017.');
  L.push('Not a diagnosis.');
  return L.join('\n');
}

/* A print-ready sheet, turned into a real on-device PDF by
   src/lib/share.js via react-native-html-to-pdf. */
export function buildReportHTML(data) {
  const p = data.profile;
  const wNow = data.body[0]?.weightKg;
  const bmiNow = bmiOf(wNow, p.heightCm);
  const bp = data.bp;
  const w30 = bp.filter(r => within(r.ts, 30));
  const w7 = bp.filter(r => within(r.ts, 7));
  const f = data.sugar.filter(r => r.kind === 'fasting');
  const pm = data.sugar.filter(r => r.kind === 'post');
  const row = (k, v) => (v ? `<tr><th>${k}</th><td>${v}</td></tr>` : '');

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Vitals report${p.name ? ` — ${p.name}` : ''}</title>
<style>
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111; margin: 0; font-size: 12px; line-height: 1.55; }
  h1 { font-size: 19px; margin: 0 0 2px; letter-spacing: -.02em; }
  .meta { color: #666; font-size: 11px; margin-bottom: 18px; }
  h2 { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #666;
       border-bottom: 1px solid #ccc; padding-bottom: 5px; margin: 20px 0 9px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-weight: 500; color: #666; width: 34%; padding: 3px 0; vertical-align: top; }
  td { padding: 3px 0; font-weight: 600; }
  table.log th, table.log td { font-weight: 500; color: #111; padding: 5px 8px 5px 0; border-bottom: 1px solid #eee; width: auto; font-size: 11px; }
  table.log thead th { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: #888; border-bottom: 1px solid #bbb; }
  .foot { margin-top: 24px; padding-top: 10px; border-top: 1px solid #ccc; color: #666; font-size: 10px; }
</style></head><body>
<h1>Vitals report${p.name ? ` — ${p.name}` : ''}</h1>
<div class="meta">Generated ${new Date().toLocaleString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · self-measured at home</div>

<h2>Patient</h2>
<table>
  ${row('Name', p.name || '—')}
  ${row('Age', p.age ? `${p.age} years` : '—')}
  ${row('Sex', p.sex ? p.sex.charAt(0).toUpperCase() + p.sex.slice(1) : '—')}
  ${row('Height', p.heightCm ? `${p.heightCm} cm` : '—')}
  ${row('Weight', wNow ? `${kg1(wNow)} kg` : '—')}
  ${row('BMI', bmiNow ? `${bmiNow} — ${classifyBMI(bmiNow).label}` : '—')}
  ${row('Diet', p.diet === 'veg' ? 'Vegetarian' : p.diet === 'egg' ? 'Eggetarian' : 'Non-vegetarian')}
</table>

<h2>Blood pressure</h2>
<table>
  ${bp.length ? row('Latest', `${bp[0].sys}/${bp[0].dia} mmHg — ${classifyBP(bp[0].sys, bp[0].dia).label}, ${fmtDay(bp[0].ts).toLowerCase()} ${fmtTime(bp[0].ts)}`) : '<tr><td>No readings recorded.</td></tr>'}
  ${w7.length ? row('7-day mean', `${avg(w7.map(r => r.sys))}/${avg(w7.map(r => r.dia))} mmHg (${w7.length} readings)`) : ''}
  ${w30.length ? row('30-day mean', `${avg(w30.map(r => r.sys))}/${avg(w30.map(r => r.dia))} mmHg (${w30.length} readings)`) : ''}
  ${bp.length ? row('Spread', `${Math.min(...bp.map(r => r.sys))}–${Math.max(...bp.map(r => r.sys))} / ${Math.min(...bp.map(r => r.dia))}–${Math.max(...bp.map(r => r.dia))} mmHg`) : ''}
  ${bp.length ? row('In range', `${bp.filter(r => classifyBP(r.sys, r.dia).k === 'normal').length} of ${bp.length}`) : ''}
</table>

${data.sugar.length ? `<h2>Blood sugar</h2><table>
  ${f.length ? row('Fasting', `mean ${avg(f.map(r => r.mgdl))} mg/dL, latest ${f[0].mgdl} (${f.length})`) : ''}
  ${pm.length ? row('After meal', `mean ${avg(pm.map(r => r.mgdl))} mg/dL, latest ${pm[0].mgdl} (${pm.length})`) : ''}
</table>` : ''}

${data.meds.length ? `<h2>Medications</h2>
<table class="log"><thead><tr><th>Medicine</th><th>Dose</th><th>When</th></tr></thead><tbody>
${data.meds.map(m => `<tr><td>${m.name}</td><td>${m.dose || '—'}</td><td>${m.slots.map(k => `${slotOf(k).label} ${prettyTime((data.medSettings?.times || {})[k] || slotOf(k).time)}`).join('<br>')}</td></tr>`).join('')}
</tbody></table>
${adherence(data, 7).pct != null ? `<p style="font-size:11px;color:#666">Doses taken as scheduled, last 7 days: ${adherence(data, 7).done} of ${adherence(data, 7).due} (${adherence(data, 7).pct}%). Patient-entered list, not verified against a prescription.</p>` : ''}` : ''}

${bp.length ? `<h2>Pressure log</h2>
<table class="log"><thead><tr><th>Date</th><th>Time</th><th>Sys/Dia</th><th>Pulse</th><th>Category</th></tr></thead><tbody>
${bp.slice(0, 40).map(r => `<tr><td>${new Date(r.ts).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</td><td>${fmtTime(r.ts)}</td><td>${r.sys}/${r.dia}</td><td>${r.pulse || '—'}</td><td>${classifyBP(r.sys, r.dia).label}</td></tr>`).join('')}
</tbody></table>` : ''}

<div class="foot">Measured at home by the patient. Reference ranges follow ACC/AHA 2017; BMI uses WHO Asia-Pacific cut-offs. This is a record, not a diagnosis.</div>
</body></html>`;
}

/* A short version for messaging. WhatsApp and mailto links choke on
   very long URLs, so the full log stays in the PDF. */
export function buildShareText(data) {
  const p = data.profile;
  const wNow = data.body[0]?.weightKg;
  const bmiNow = bmiOf(wNow, p.heightCm);
  const bp = data.bp;
  const w30 = bp.filter(r => within(r.ts, 30));
  const L = [];

  L.push(`Vitals report${p.name ? ` — ${p.name}` : ''}`);
  L.push(new Date().toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
  L.push('');
  L.push(`Age ${p.age || '—'} · Height ${p.heightCm || '—'} cm · Weight ${wNow ? `${kg1(wNow)} kg` : '—'}${bmiNow ? ` · BMI ${bmiNow} (${classifyBMI(bmiNow).label})` : ''}`);
  L.push('');

  if (bp.length) {
    L.push('BLOOD PRESSURE');
    L.push(`Latest: ${bp[0].sys}/${bp[0].dia} mmHg — ${classifyBP(bp[0].sys, bp[0].dia).label}${bp[0].pulse ? `, pulse ${bp[0].pulse}` : ''}`);
    if (w30.length) L.push(`30-day mean: ${avg(w30.map(r => r.sys))}/${avg(w30.map(r => r.dia))} mmHg over ${w30.length} readings`);
    L.push(`In range: ${bp.filter(r => classifyBP(r.sys, r.dia).k === 'normal').length} of ${bp.length}`);
    L.push('');
    L.push('Recent readings');
    bp.slice(0, 8).forEach(r =>
      L.push(`${new Date(r.ts).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} ${fmtTime(r.ts)} — ${r.sys}/${r.dia}${r.pulse ? `, ${r.pulse} bpm` : ''}`),
    );
    if (bp.length > 8) L.push(`…and ${bp.length - 8} more`);
    L.push('');
  }

  const f = data.sugar.filter(r => r.kind === 'fasting');
  const pm = data.sugar.filter(r => r.kind === 'post');
  if (data.sugar.length) {
    L.push('BLOOD SUGAR');
    if (f.length) L.push(`Fasting: latest ${f[0].mgdl} mg/dL, mean ${avg(f.map(r => r.mgdl))}`);
    if (pm.length) L.push(`After meal: latest ${pm[0].mgdl} mg/dL, mean ${avg(pm.map(r => r.mgdl))}`);
    L.push('');
  }

  if (data.meds.length) {
    L.push('MEDICINES');
    data.meds.forEach(m => L.push(`${m.name}${m.dose ? ` — ${m.dose}` : ''} · ${m.slots.map(k => slotOf(k).label).join(', ')}`));
    L.push('');
  }

  L.push('Measured at home. Not a diagnosis.');
  return L.join('\n');
}
