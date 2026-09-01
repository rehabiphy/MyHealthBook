import React, { useState, useEffect, useRef, useMemo } from "react";

/* ══════════════════════════════════════════════════════════════════
   ANEROID — a home vitals record.
   Direction: the analog BP dial and the prescription pad. Warm bone
   paper, one deep forest panel that carries the reading, mono set for
   every unit and timestamp the way it's printed on a monitor.
   Colour never decorates; it only ever states a range.
══════════════════════════════════════════════════════════════════ */

const C = {
  paper: "#2B1B63",                          // violet ground (gradient layers on top)
  card: "rgba(255,255,255,0.10)",            // frosted glass
  cardSolid: "#3A2A78",                      // where glass must not stack
  panel: "rgba(255,255,255,0.16)",           // raised glass
  panelSoft: "rgba(167,139,250,0.22)",       // accent-tinted glass
  ink: "#FFFFFF",
  ink2: "rgba(255,255,255,0.76)",
  ink3: "rgba(255,255,255,0.54)",
  hair: "rgba(255,255,255,0.20)",
  onPanel: "#FFFFFF",
  onPanel2: "rgba(255,255,255,0.72)",
  brand: "#B79CFF",                          // violet — the app's voice
  brand2: "#EC7FD0",                         // pink, the far end of every gradient
  mint: "#4ADE80",
  low: "#7DB4FF",
  normal: "#4ADE80",
  elevated: "#FBBF24",
  stage1: "#FB923C",
  stage2: "#FB7185",
  crisis: "#F472B6",
};

/* One gradient, used on every primary action and active state. */
const GRAD = "linear-gradient(135deg, #A78BFA 0%, #EC7FD0 100%)";
const GRAD_SOFT = "linear-gradient(135deg, rgba(167,139,250,0.30) 0%, rgba(236,127,208,0.22) 100%)";

const SANS = `'Schibsted Grotesk', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`;
const MONO = `'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace`;

/* ───────────────────────────── logic ───────────────────────────── */

const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const fmtDay = (ts) => {
  if (sameDay(ts, Date.now())) return "TODAY";
  if (sameDay(ts, Date.now() - 864e5)) return "YESTERDAY";
  return new Date(ts).toLocaleDateString(undefined, { day: "2-digit", month: "short" }).toUpperCase();
};
const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });

function classifyBP(sys, dia) {
  if (sys > 180 || dia > 120) return { k: "crisis", label: "Crisis range", color: C.crisis, note: "Get medical help now" };
  if (sys < 90 || dia < 60) return { k: "low", label: "Low", color: C.low, note: "Below the usual range" };
  if (sys >= 140 || dia >= 90) return { k: "stage2", label: "High · stage 2", color: C.stage2, note: "Worth a doctor's review" };
  if (sys >= 130 || dia >= 80) return { k: "stage1", label: "High · stage 1", color: C.stage1, note: "Above target" };
  if (sys >= 120) return { k: "elevated", label: "Elevated", color: C.elevated, note: "Slightly above ideal" };
  return { k: "normal", label: "In range", color: C.normal, note: "Healthy reading" };
}

function classifyBMI(b) {
  if (!b) return null;
  if (b < 18.5) return { label: "Underweight", color: C.low };
  if (b < 23) return { label: "In range", color: C.normal };
  if (b < 25) return { label: "Overweight", color: C.elevated };
  if (b < 30) return { label: "Obese I", color: C.stage1 };
  return { label: "Obese II", color: C.stage2 };
}

function classifySugar(v, kind) {
  if (v < 70) return { label: "Low", color: C.low };
  if (kind === "fasting") {
    if (v < 100) return { label: "In range", color: C.normal };
    if (v < 126) return { label: "Pre-diabetes range", color: C.elevated };
    return { label: "Diabetes range", color: C.stage2 };
  }
  if (v < 140) return { label: "In range", color: C.normal };
  if (v < 200) return { label: "Pre-diabetes range", color: C.elevated };
  return { label: "Diabetes range", color: C.stage2 };
}

const kg1 = (v) => (v == null || isNaN(+v) ? "—" : Number(v).toFixed(1));

const bmiOf = (kg, cm) => (kg && cm ? +(kg / Math.pow(cm / 100, 2)).toFixed(1) : null);

const BANDS = [
  { from: 80, to: 90, color: C.low },
  { from: 90, to: 120, color: C.normal },
  { from: 120, to: 130, color: C.elevated },
  { from: 130, to: 140, color: C.stage1 },
  { from: 140, to: 180, color: C.stage2 },
];

const BMI_BANDS = [
  { from: 14, to: 18.5, color: C.low },
  { from: 18.5, to: 23, color: C.normal },
  { from: 23, to: 25, color: C.elevated },
  { from: 25, to: 30, color: C.stage1 },
  { from: 30, to: 40, color: C.stage2 },
];

/* ───────────────────────────── atoms ───────────────────────────── */

const Mono = ({ children, style }) => (
  <span
    style={{
      fontFamily: MONO,
      fontSize: 10.5,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: C.ink3,
      ...style,
    }}
  >
    {children}
  </span>
);

/* Every screen opens the same way: title, mono caption, optional right
   slot. Built once so the six screens can't drift apart. */
function Head({ title, caption, right, size = 26, icon, tint }) {
  return (
    <div className="flex items-start justify-between" style={{ gap: 12, padding: "0 4px 18px" }}>
      <div className="flex items-center" style={{ gap: 13, minWidth: 0 }}>
        {icon && (
          <span style={{ width: 42, height: 42, borderRadius: 14, flexShrink: 0, display: "grid", placeItems: "center",
            background: `${tint || C.brand}2E`, border: `1px solid ${tint || C.brand}55`,
            boxShadow: `0 6px 16px ${tint || C.brand}25` }}>
            {icon}
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: size, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.15 }}>{title}</h1>
          {caption && <Mono style={{ display: "block", marginTop: 4 }}>{caption}</Mono>}
        </div>
      </div>
      {right}
    </div>
  );
}

/* Screen glyphs, reused in headers so a screen is recognisable before
   the title is read. */
const G = {
  readings: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17.5l4.5-5 3.2 3 4.3-6 4 4.4" /><path d="M4 20.5h16" /></svg>,
  records:  (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.8h8.2L18.5 8v12.2H6z" /><path d="M14 3.8V8h4.4M9 12h6M9 15.5h4" /></svg>,
  meds:     (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.8" y="8.6" width="18.4" height="6.8" rx="3.4" transform="rotate(-45 12 12)" /><path d="M9.6 9.6l4.8 4.8" /></svg>,
  health:   (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11.2c0 4.2-8 8.8-8 8.8s-8-4.6-8-8.8A3.6 3.6 0 0 1 12 8.6a3.6 3.6 0 0 1 8 2.6z" /><path d="M7.5 12.4h2.2l1.2-2 1.7 3.4 1.1-1.4h2.6" /></svg>,
  me:       (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8.6" r="3.3" /><path d="M5.5 19.5c1.3-3.2 3.8-4.8 6.5-4.8s5.2 1.6 6.5 4.8" /></svg>,
  learn:    (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5h6.5A1.5 1.5 0 0 1 12 7v11a1.2 1.2 0 0 0-1.2-1.2H4zM20 5.5h-6.5A1.5 1.5 0 0 0 12 7v11a1.2 1.2 0 0 1 1.2-1.2H20z" /></svg>,
  coach:    (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6.5h16v9H10l-4.5 3.5v-3.5H4z" /></svg>,
};

/* Native confirm() and prompt() are blocked inside sandboxed frames and
   in some Android WebViews — the call silently returns and the action
   never happens. This replaces them with a real dialog, which is also
   far more legible than the browser's own. */
function useAsk() {
  const [q, setQ] = useState(null);
  const [val, setVal] = useState("");
  const resolve = useRef(null);

  const ask = (opts) =>
    new Promise((res) => {
      resolve.current = res;
      setVal(opts.defaultValue || "");
      setQ(opts);
    });

  const close = (result) => {
    const r = resolve.current;
    resolve.current = null;
    setQ(null);
    setVal("");
    r?.(result);
  };

  const node = q ? (
    <div
      onClick={() => close(null)}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(24,12,60,0.66)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20, maxWidth: 430, margin: "0 auto" }}
    >
      <div className="rise" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", background: "rgba(58,42,120,0.92)", border: `1px solid ${C.hair}`, borderRadius: 24, padding: 22,
          backdropFilter: "blur(28px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 24px 60px rgba(15,5,45,0.65)" }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.3 }}>{q.title}</div>
        {q.body && (
          <div style={{ fontSize: 15, color: C.ink2, marginTop: 10, lineHeight: 1.55, whiteSpace: "pre-line" }}>{q.body}</div>
        )}
        {q.input && (
          <input
            value={val}
            autoFocus
            placeholder={q.placeholder || ""}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && close(val)}
            style={{ width: "100%", marginTop: 16, border: `1px solid ${C.hair}`, borderRadius: 14,
              padding: "15px 14px", fontFamily: SANS, fontSize: 16, color: C.ink, background: "rgba(255,255,255,0.10)", outline: "none" }}
          />
        )}
        <div className="flex" style={{ gap: 8, marginTop: 20 }}>
          <Btn kind="quiet" style={{ padding: "16px", fontSize: 16 }} onClick={() => close(null)}>
            {q.cancelLabel || "Cancel"}
          </Btn>
          <Btn
            style={{ padding: "16px", fontSize: 16, background: q.danger ? C.stage2 : C.panel, color: "#fff" }}
            onClick={() => close(q.input ? (val || "") : true)}
          >
            {q.confirmLabel || "Confirm"}
          </Btn>
        </div>
      </div>
    </div>
  ) : null;

  return [node, ask];
}

function Card({ children, style, onClick, delay = 0 }) {
  return (
    <div
      onClick={onClick}
      className="rise"
      style={{
        background: C.card,
        borderRadius: 24,
        border: `1px solid ${C.hair}`,
        backdropFilter: "blur(22px) saturate(140%)",
        WebkitBackdropFilter: "blur(22px) saturate(140%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 26px rgba(20,10,60,0.28)",
        padding: 20,
        animationDelay: `${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function useCountUp(target, ms = 700) {
  const [v, setV] = useState(target ?? 0);
  const from = useRef(target ?? 0);
  useEffect(() => {
    if (target == null) return;
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (t) => {
      const p = clamp((t - start) / ms, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(a + (target - a) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/* ── SIGNATURE: the aneroid dial ──────────────────────────────────
   A 220° sweep with the pressure bands laid on the rim and a needle
   that settles on your systolic. One instrument, read at a glance. */

const A0 = 160, A1 = 380; // sweep in degrees (SVG coords, 0 = east)
const toAngle = (v, min, max) => A0 + ((clamp(v, min, max) - min) / (max - min)) * (A1 - A0);
const pt = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
function arc(cx, cy, r, a0, a1) {
  const [x0, y0] = pt(cx, cy, r, a0);
  const [x1, y1] = pt(cx, cy, r, a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

function Dial({ value, min = 80, max = 180, bands, size = 210, dark = true, animate = true }) {
  const [live, setLive] = useState(animate ? min : value);
  useEffect(() => {
    const t = setTimeout(() => setLive(value), 60);
    return () => clearTimeout(t);
  }, [value]);
  const cx = size / 2, cy = size / 2, r = size / 2 - 16;
  const angle = toAngle(live ?? min, min, max);
  const ticks = [];
  for (let v = min; v <= max; v += 10) ticks.push(v);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <path
        d={arc(cx, cy, r, A0, A1)}
        stroke="rgba(255,255,255,0.10)"
        strokeWidth={10}
        fill="none"
        strokeLinecap="round"
      />
      {bands.map((b, i) => (
        <path
          key={i}
          d={arc(cx, cy, r, toAngle(b.from, min, max) + 0.8, toAngle(b.to, min, max) - 0.8)}
          stroke={b.color}
          strokeWidth={10}
          fill="none"
          strokeLinecap="butt"
          opacity={0.92}
        />
      ))}
      {ticks.map((v, i) => {
        const a = toAngle(v, min, max);
        const [x0, y0] = pt(cx, cy, r - 11, a);
        const [x1, y1] = pt(cx, cy, r - (v % 20 === 0 ? 18 : 15), a);
        return (
          <line
            key={i}
            x1={x0} y1={y0} x2={x1} y2={y1}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1.2}
          />
        );
      })}
      <g style={{ transition: "transform 1100ms cubic-bezier(.16,1,.3,1)", transform: `rotate(${angle}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
        <line x1={cx} y1={cy} x2={cx + r - 20} y2={cy} stroke={dark ? C.onPanel : C.ink} strokeWidth={2.4} strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r={5} fill={dark ? C.onPanel : C.ink} />
      <circle cx={cx} cy={cy} r={11} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
    </svg>
  );
}

/* Flat range scale, used where a dial would be too loud */
function Scale({ bands, value, min, max, label }) {
  const pos = ((clamp(value, min, max) - min) / (max - min)) * 100;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ position: "relative", height: 8 }}>
        <div style={{ display: "flex", gap: 2, height: 8, borderRadius: 99, overflow: "hidden" }}>
          {bands.map((b, i) => (
            <div key={i} style={{ flex: b.to - b.from, background: b.color, opacity: 0.9 }} />
          ))}
        </div>
        <div
          style={{
            position: "absolute", left: `${pos}%`, top: -5, transform: "translateX(-50%)",
            width: 3, height: 18, borderRadius: 99, background: C.ink,
            boxShadow: `0 0 0 3px ${C.paper}`, transition: "left 600ms cubic-bezier(.16,1,.3,1)",
          }}
        />
      </div>
      <div className="flex justify-between" style={{ marginTop: 8 }}>
        <Mono>{min}</Mono>
        {label && <Mono>{label}</Mono>}
        <Mono>{max}</Mono>
      </div>
    </div>
  );
}

/* Trend with a scrubber — tap any point to read that entry */
function Trend({ rows, onPick, picked }) {
  const w = 320, h = 130, padX = 10, padT = 14, padB = 22;
  if (rows.length < 2)
    return (
      <div style={{ padding: "28px 0", textAlign: "center" }}>
        <Mono>Two readings draw the trend</Mono>
      </div>
    );
  const sys = rows.map((r) => r.sys), dia = rows.map((r) => r.dia);
  const lo = Math.min(...dia, 70) - 10, hi = Math.max(...sys, 130) + 10;
  const X = (i) => padX + (i / (rows.length - 1)) * (w - padX * 2);
  const Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
  const line = (arr) => arr.map((v, i) => `${X(i)},${Y(v)}`).join(" ");
  const area = `${line(sys)} ${X(rows.length - 1)},${h - padB} ${X(0)},${h - padB}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 150 }}>
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={C.stage1} stopOpacity="0.32" />
          <stop offset="100%" stopColor={C.stage1} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[120, 80].map((v) => (
        <g key={v}>
          <line x1={padX} x2={w - padX} y1={Y(v)} y2={Y(v)} stroke={C.hair} strokeDasharray="2 5" />
          <text x={w - padX} y={Y(v) - 4} textAnchor="end" fontFamily={MONO} fontSize="8" fill={C.ink3}>{v}</text>
        </g>
      ))}
      <polygon points={area} fill="url(#g)" />
      <polyline points={line(sys)} fill="none" stroke={C.stage1} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={line(dia)} fill="none" stroke={C.brand} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {rows.map((r, i) => (
        <g key={r.id} onClick={() => onPick(i)} style={{ cursor: "pointer" }}>
          <rect x={X(i) - 12} y={0} width={24} height={h} fill="transparent" />
          {picked === i && <line x1={X(i)} x2={X(i)} y1={padT - 6} y2={h - padB} stroke={C.ink3} strokeWidth={1} />}
          <circle cx={X(i)} cy={Y(r.sys)} r={picked === i ? 4.5 : 2.6} fill={C.stage1} stroke={C.paper} strokeWidth={picked === i ? 2 : 0} />
          <circle cx={X(i)} cy={Y(r.dia)} r={picked === i ? 4.5 : 2.6} fill={C.brand} stroke={C.paper} strokeWidth={picked === i ? 2 : 0} />
          <text x={X(i)} y={h - 6} textAnchor="middle" fontFamily={MONO} fontSize="8" fill={picked === i ? C.ink : C.ink3}>
            {new Date(r.ts).getDate()}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Btn({ children, onClick, kind = "solid", disabled, style }) {
  const kinds = {
    solid: { background: GRAD, color: "#FFFFFF", boxShadow: "0 8px 22px rgba(167,139,250,0.40)" },
    brand: { background: "linear-gradient(135deg, #4ADE80 0%, #22B8A6 100%)", color: "#06231A",
             boxShadow: "0 8px 22px rgba(74,222,128,0.32)" },
    quiet: { background: "rgba(255,255,255,0.12)", color: C.ink, border: `1px solid ${C.hair}` },
  };
  return (
    <button
      className="press"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: "100%", border: "none", borderRadius: 15, padding: "16px 18px",
        fontFamily: SANS, fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1,
        ...kinds[kind], ...style,
      }}
    >
      {children}
    </button>
  );
}

function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.10)", padding: 4, borderRadius: 16 }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="press"
          style={{
            flex: 1, border: "none", borderRadius: 11, padding: "10px 4px", cursor: "pointer",
            fontFamily: SANS, fontSize: 13.5, fontWeight: 600,
            background: value === o.value ? GRAD : "transparent",
            color: value === o.value ? "#FFFFFF" : C.ink2,
            boxShadow: value === o.value ? "0 4px 14px rgba(167,139,250,0.35)" : "none",
            transition: "background 160ms ease",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* Stepper — hold the keys to run, or tap the number and type it.
   decimals: 0 for whole units (mmHg, cm), 1 for weight. */
function Stepper({ label, unit, value, set, step = 1, min, max, decimals = 0 }) {
  const hold = useRef(null);
  const input = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const round = (n) => +clamp(n, min, max).toFixed(decimals);
  const shown = value === "" || value == null || isNaN(+value)
    ? "––"
    : decimals
    ? Number(value).toFixed(decimals)
    : String(value);

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);

  const bump = (d) => set(round((+value || min) + d));
  const start = (d) => {
    stop();
    bump(d);
    hold.current = setTimeout(function rep() {
      bump(d);
      hold.current = setTimeout(rep, 70);
    }, 430);
  };
  const stop = () => { clearTimeout(hold.current); hold.current = null; };
  useEffect(() => stop, []);

  const open = () => { setDraft(shown === "––" ? "" : shown); setEditing(true); };
  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n)) set(round(n));
    setEditing(false);
  };
  const clean = (s) => {
    let v = s.replace(decimals ? /[^\d.]/g : /\D/g, "");
    if (decimals) {
      const [a, ...rest] = v.split(".");
      v = rest.length ? `${a}.${rest.join("").slice(0, decimals)}` : a;
    }
    return v.slice(0, decimals ? 5 : 3);
  };

  const keyBtn = (d, sym) => (
    <button
      className="press"
      aria-label={d < 0 ? `decrease ${label}` : `increase ${label}`}
      onMouseDown={() => start(d)} onMouseUp={stop} onMouseLeave={stop}
      onTouchStart={(e) => { e.preventDefault(); start(d); }}
      onTouchEnd={(e) => { e.preventDefault(); stop(); }}
      onTouchCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: 48, height: 48, borderRadius: 999, border: `1px solid ${C.hair}`,
        background: "rgba(255,255,255,0.13)", color: C.ink, fontSize: 22, lineHeight: 1, cursor: "pointer",
        fontFamily: SANS, fontWeight: 500, flexShrink: 0, userSelect: "none", touchAction: "manipulation",
      }}
    >
      {sym}
    </button>
  );

  const numStyle = {
    fontSize: 46, fontWeight: 700, letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums",
    color: C.ink, lineHeight: 1, fontFamily: SANS,
  };

  return (
    <div style={{ padding: "18px 0", borderBottom: `1px solid ${C.hair}` }}>
      <div className="flex items-center justify-between">
        <Mono>{label}</Mono>
        <Mono style={{ fontSize: 9.5 }}>{editing ? "enter to set" : `${min}–${max}`}</Mono>
      </div>

      <div className="flex items-center justify-between" style={{ marginTop: 10, gap: 8 }}>
        {keyBtn(-step, "−")}

        <div
          className="flex items-baseline justify-center"
          onClick={() => !editing && open()}
          style={{
            gap: 6, flex: 1, cursor: "text", padding: "4px 6px", borderRadius: 12,
            background: editing ? "rgba(255,255,255,0.14)" : "transparent",
            boxShadow: editing ? `inset 0 0 0 1px ${C.hair}` : "none",
            transition: "background 160ms ease",
          }}
        >
          {editing ? (
            <input
              ref={input}
              value={draft}
              inputMode="decimal"
              onChange={(e) => setDraft(clean(e.target.value))}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
                if (e.key === "ArrowUp") { e.preventDefault(); setDraft(String(round((+draft || min) + step))); }
                if (e.key === "ArrowDown") { e.preventDefault(); setDraft(String(round((+draft || min) - step))); }
              }}
              style={{
                ...numStyle, width: `${Math.max(2, draft.length)}ch`, minWidth: "2ch",
                border: "none", outline: "none", background: "transparent", textAlign: "center", padding: 0,
              }}
            />
          ) : (
            <span style={numStyle}>{shown}</span>
          )}
          <Mono style={{ fontSize: 10 }}>{unit}</Mono>
        </div>

        {keyBtn(step, "+")}
      </div>
    </div>
  );
}

/* ───────────────────────────── home ────────────────────────────── */

const APP_NAME = "MyHealthBook";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

/* A tinted glyph chip — the small round icon on each stat tile. */
function Chip({ color, children, size = 34 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 999, background: `${color}30`,
      border: `1px solid ${color}55`,
      display: "grid", placeItems: "center", flexShrink: 0 }}>
      {children}
    </span>
  );
}

const GaugeGlyph = ({ c }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round">
    <circle cx="12" cy="12" r="8" /><path d="M12 12l3.5-2.5" />
  </svg>
);
const PulseGlyph = ({ c }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 11.2c0 4.2-8 8.8-8 8.8s-8-4.6-8-8.8A3.6 3.6 0 0 1 12 8.6a3.6 3.6 0 0 1 8 2.6z" />
    <path d="M7.5 12.4h2.2l1.2-2 1.7 3.4 1.1-1.4h2.6" />
  </svg>
);

function Home({ data, go }) {
  const bp = data.bp[0];
  const w = data.body[0];
  const sugar = data.sugar[0];
  const bmi = bmiOf(w?.weightKg, data.profile.heightCm);
  const cat = bp ? classifyBP(bp.sys, bp.dia) : null;
  const rows = useMemo(() => [...data.bp].slice(0, 10).reverse(), [data.bp]);
  const [picked, setPicked] = useState(null);
  const shown = picked != null ? rows[picked] : rows[rows.length - 1];
  const doses = dosesToday(data);
  const left = doses.filter((x) => !isTaken(data, x.id));
  const hist = data.history || [];

  const Label = ({ children }) => (
    <Mono style={{ display: "block", fontSize: 10.5, padding: "0 4px 10px" }}>{children}</Mono>
  );

  /* One of the two TODAY tiles. */
  const Tile = ({ glyph, color, name, value, unit, when, onClick, delay }) => (
    <Card delay={delay} style={{ flex: 1, minWidth: 0, padding: 16 }} onClick={onClick}>
      <div className="flex items-center" style={{ gap: 9 }}>
        <Chip color={color}>{glyph}</Chip>
        <Mono style={{ fontSize: 9.5 }}>{name}</Mono>
      </div>
      <div className="flex items-baseline" style={{ gap: 5, marginTop: 14 }}>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.045em", fontVariantNumeric: "tabular-nums", color: C.ink }}>
          {value}
        </span>
        <span style={{ fontSize: 12, color: C.ink3, fontWeight: 500 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 6 }}>{when}</div>
    </Card>
  );

  return (
    <div style={{ padding: "0 16px 120px" }}>
      {/* greeting */}
      <div style={{ padding: "26px 4px 20px" }}>
        <div style={{ fontSize: 31, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.15,
          background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          {greeting()},<br />{data.profile.name || "there"}
        </div>
      </div>

      {/* the book itself */}
      <Card style={{ padding: 18 }} onClick={() => go("health")}>
        <div className="flex items-center" style={{ gap: 15 }}>
          <Chip color={C.brand} size={52}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 3.5h6v2.5H9z" />
              <path d="M8.5 13h2l1.3-2.2 1.7 3.7 1.1-1.5h2.1" />
            </svg>
          </Chip>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.03em" }}>{APP_NAME}</div>
            <div style={{ fontSize: 14, color: C.ink2, marginTop: 3, lineHeight: 1.4 }}>
              Your health information, organised in one place.
            </div>
          </div>
        </div>
      </Card>

      {/* today */}
      <div style={{ paddingTop: 26 }}><Label>Today</Label></div>
      <div className="flex" style={{ gap: 10 }}>
        <Tile delay={40} glyph={<GaugeGlyph c={cat ? cat.color : C.low} />} color={cat ? cat.color : C.low}
          name="Blood pressure" value={bp ? `${bp.sys}/${bp.dia}` : "––"} unit="mmHg"
          when={bp ? `${fmtDay(bp.ts).toLowerCase()}, ${fmtTime(bp.ts)}` : "not recorded"} onClick={() => go("log")} />
        <Tile delay={80} glyph={<PulseGlyph c={C.stage2} />} color={C.stage2}
          name="Heart rate" value={bp?.pulse || "––"} unit="bpm"
          when={bp?.pulse ? `${fmtDay(bp.ts).toLowerCase()}, ${fmtTime(bp.ts)}` : "not recorded"} onClick={() => go("log")} />
      </div>

      {bp && (
        <Card delay={110} style={{ marginTop: 10, padding: 18 }} onClick={() => go("log")}>
          <div className="flex items-center justify-between" style={{ gap: 12 }}>
            <div className="flex items-center" style={{ gap: 10, minWidth: 0 }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: cat.color, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.02em" }}>{cat.label}</div>
                <Mono style={{ display: "block", marginTop: 3 }}>{cat.note}</Mono>
              </div>
            </div>
            <div style={{ flexShrink: 0, marginRight: -6, marginBottom: -34, marginTop: -18, opacity: 0.95 }}>
              <Dial value={bp.sys} bands={BANDS} size={112} />
            </div>
          </div>
        </Card>
      )}

      {/* medicines today */}
      {doses.length > 0 && (
        <>
          <div style={{ paddingTop: 26 }}>
            <div className="flex items-baseline justify-between" style={{ padding: "0 4px 10px" }}>
              <Mono style={{ fontSize: 10.5 }}>Medicines today</Mono>
              <Mono style={{ fontSize: 10.5 }}>{doses.length - left.length}/{doses.length} taken</Mono>
            </div>
          </div>
          <Card delay={140} style={{ padding: 0, overflow: "hidden" }}>
            {doses.slice(0, 4).map((d, i, arr) => {
              const done = isTaken(data, d.id);
              return (
                <div key={d.id} className="flex items-center" style={{ gap: 14, padding: "15px 17px",
                  borderBottom: i < arr.length - 1 ? `1px solid ${C.hair}` : "none" }}>
                  <span onClick={() => go("meds")} style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0,
                    background: done ? "linear-gradient(135deg, #4ADE80 0%, #22B8A6 100%)" : "rgba(255,255,255,0.08)", border: done ? "none" : `1.5px solid ${C.hair}`,
                    display: "grid", placeItems: "center", cursor: "pointer" }}>
                    {done && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#08221A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }} onClick={() => go("meds")}>
                    <div style={{ fontSize: 16.5, fontWeight: 600, letterSpacing: "-0.02em",
                      color: done ? C.ink3 : C.ink, textDecoration: done ? "line-through" : "none",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.med.name}
                    </div>
                    <div style={{ fontSize: 13.5, color: C.ink3, marginTop: 3 }}>
                      {slotOf(d.slot).label} · {prettyTime(d.time)}
                    </div>
                  </div>
                </div>
              );
            })}
            {doses.length > 4 && (
              <div onClick={() => go("meds")} style={{ padding: "13px 17px", borderTop: `1px solid ${C.hair}`, cursor: "pointer" }}>
                <Mono>+{doses.length - 4} more today</Mono>
              </div>
            )}
          </Card>
        </>
      )}

      {/* body + sugar */}
      <div style={{ paddingTop: 26 }}><Label>Body and sugar</Label></div>
      <div className="flex" style={{ gap: 10 }}>
        <Card delay={170} style={{ flex: 1, padding: 16 }} onClick={() => go("log")}>
          <Mono style={{ fontSize: 9.5 }}>Body mass</Mono>
          <div className="flex items-baseline" style={{ gap: 5, marginTop: 12 }}>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.045em", fontVariantNumeric: "tabular-nums" }}>{bmi ?? "––"}</span>
            <span style={{ fontSize: 12, color: C.ink3 }}>bmi</span>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6, color: bmi ? classifyBMI(bmi).color : C.ink3 }}>
            {bmi ? classifyBMI(bmi).label : "add height & weight"}
          </div>
        </Card>
        <Card delay={200} style={{ flex: 1, padding: 16 }} onClick={() => go("log")}>
          <Mono style={{ fontSize: 9.5 }}>Blood sugar</Mono>
          <div className="flex items-baseline" style={{ gap: 5, marginTop: 12 }}>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.045em", fontVariantNumeric: "tabular-nums" }}>{sugar?.mgdl ?? "––"}</span>
            <span style={{ fontSize: 12, color: C.ink3 }}>mg/dl</span>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6, color: sugar ? classifySugar(sugar.mgdl, sugar.kind).color : C.ink3 }}>
            {sugar ? classifySugar(sugar.mgdl, sugar.kind).label : "not recorded"}
          </div>
        </Card>
      </div>

      {/* trend */}
      {rows.length > 1 && (
        <>
          <div style={{ paddingTop: 26 }}><Label>Last {rows.length} readings</Label></div>
          <Card delay={230} style={{ paddingBottom: 14 }}>
            <div className="flex justify-end" style={{ gap: 12 }}>
              <span className="flex items-center" style={{ gap: 5 }}><span style={{ width: 10, height: 2, background: C.stage1, borderRadius: 9 }} /><Mono>sys</Mono></span>
              <span className="flex items-center" style={{ gap: 5 }}><span style={{ width: 10, height: 2, background: C.brand, borderRadius: 9 }} /><Mono>dia</Mono></span>
            </div>
            <Trend rows={rows} picked={picked} onPick={setPicked} />
            {shown && (
              <div className="flex items-center justify-between" style={{ borderTop: `1px solid ${C.hair}`, paddingTop: 12 }}>
                <Mono>{fmtDay(shown.ts)} · {fmtTime(shown.ts)}</Mono>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{shown.sys}/{shown.dia}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: classifyBP(shown.sys, shown.dia).color }}>{classifyBP(shown.sys, shown.dia).label}</span>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* the other layers */}
      <div style={{ paddingTop: 26 }}><Label>Your health</Label></div>
      {weeklyDue(data) && (
        <Card style={{ marginBottom: 10, background: C.panelSoft, border: `1px solid ${C.hair}` }} onClick={() => go("me")}>
          <Mono style={{ color: C.brand }}>Weekly update ready</Mono>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.025em", marginTop: 7 }}>
            Send this week to {data.care.circle.filter((m) => m.weekly).map((m) => m.name).join(", ")}
          </div>
        </Card>
      )}
      <div className="flex" style={{ gap: 10 }}>
        <Card delay={260} style={{ flex: 1, padding: 18 }} onClick={() => go("health")}>
          <Mono style={{ fontSize: 9.5 }}>Health summary</Mono>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.025em", marginTop: 9, lineHeight: 1.3 }}>
            {(data.health?.conditions?.length || 0) > 0 ? `${data.health.conditions.length} condition${data.health.conditions.length === 1 ? "" : "s"}` : "Set up"}
          </div>
          <Mono style={{ display: "block", marginTop: 5 }}>{data.health?.bloodGroup ? `blood ${data.health.bloodGroup}` : "what matters today"}</Mono>
        </Card>
        <Card delay={290} style={{ flex: 1, padding: 18 }} onClick={() => go("history")}>
          <Mono style={{ fontSize: 9.5 }}>Medical records</Mono>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.025em", marginTop: 9, lineHeight: 1.3 }}>
            {hist.length > 0 ? `${hist.length} record${hist.length === 1 ? "" : "s"}` : "Add the past"}
          </div>
          <Mono style={{ display: "block", marginTop: 5 }}>
            {hist.length ? `last ${fmtDay([...hist].sort((a, b) => b.date - a.date)[0].date).toLowerCase()}` : "tests, scans, surgery"}
          </Mono>
        </Card>
      </div>

      <Card delay={320} style={{ marginTop: 10, background: C.panelSoft, border: `1px solid ${C.hair}` }} onClick={() => go("coach")}>
        <Mono style={{ color: C.brand }}>AI coach</Mono>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.025em", marginTop: 8 }}>What to eat, how to move</div>
        <div style={{ fontSize: 13.5, color: C.ink2, marginTop: 5, lineHeight: 1.5 }}>
          Meals and workouts built from your own numbers.
        </div>
      </Card>
    </div>
  );
}


/* ───────────────────────────── record ──────────────────────────── */

function Log({ data, setData }) {
  const [tab, setTab] = useState("bp");
  const [sys, setSys] = useState(120);
  const [dia, setDia] = useState(80);
  const [pulse, setPulse] = useState(72);
  const [kg, setKg] = useState(data.body[0]?.weightKg || 65);
  const [cm, setCm] = useState(+data.profile.heightCm || 170);
  const [mgdl, setMgdl] = useState(95);
  const [kind, setKind] = useState("fasting");
  const [toast, setToast] = useState("");

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 1800); };
  const cat = classifyBP(sys, dia);
  const bmi = bmiOf(kg, cm);

  const list =
    tab === "bp"
      ? data.bp.map((r) => ({ ...r, main: `${r.sys}/${r.dia}`, unit: "mmHg", sub: r.pulse ? `${r.pulse} bpm` : "", cat: classifyBP(r.sys, r.dia) }))
      : tab === "body"
      ? data.body.map((r) => {
          const b = bmiOf(r.weightKg, data.profile.heightCm);
          return { ...r, main: kg1(r.weightKg), unit: "kg", sub: b ? `bmi ${b}` : "", cat: classifyBMI(b) || { color: C.ink3, label: "" } };
        })
      : data.sugar.map((r) => ({ ...r, main: `${r.mgdl}`, unit: "mg/dl", sub: r.kind === "fasting" ? "fasting" : "after meal", cat: classifySugar(r.mgdl, r.kind) }));

  const remove = (id) =>
    setData((d) => ({ ...d, bp: d.bp.filter((r) => r.id !== id), body: d.body.filter((r) => r.id !== id), sugar: d.sugar.filter((r) => r.id !== id) }));

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      <Head title="Readings" caption="pressure · body · sugar" icon={G.readings(C.low)} tint={C.low} />
      <Seg value={tab} onChange={setTab} options={[{ value: "bp", label: "Pressure" }, { value: "body", label: "Body" }, { value: "sugar", label: "Sugar" }]} />

      <Card style={{ marginTop: 12, paddingTop: 4 }}>
        {tab === "bp" && (
          <>
            <Stepper label="Systolic — upper" unit="mmHg" value={sys} set={setSys} min={70} max={220} />
            <Stepper label="Diastolic — lower" unit="mmHg" value={dia} set={setDia} min={40} max={140} />
            <Stepper label="Pulse" unit="bpm" value={pulse} set={setPulse} min={35} max={200} />
            <div style={{ paddingTop: 16 }}>
              <div className="flex items-center" style={{ gap: 9 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: cat.color }} />
                <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>{cat.label}</span>
              </div>
              <Scale bands={BANDS} value={sys} min={80} max={180} label="systolic" />
              <Btn
                style={{ marginTop: 16 }}
                onClick={() => {
                  setData((d) => ({ ...d, bp: [{ id: uid(), ts: Date.now(), sys, dia, pulse }, ...d.bp] }));
                  flash("Reading saved");
                }}
              >
                Save reading
              </Btn>
            </div>
          </>
        )}

        {tab === "body" && (
          <>
            <Stepper label="Height" unit="cm" value={cm} set={setCm} min={120} max={215} />
            <Stepper label="Weight" unit="kg" value={kg} set={setKg} min={25} max={200} step={0.1} decimals={1} />
            <div style={{ paddingTop: 16 }}>
              <div className="flex items-baseline" style={{ gap: 8 }}>
                <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums" }}>{bmi}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: classifyBMI(bmi).color }}>{classifyBMI(bmi).label}</span>
              </div>
              <Scale bands={BMI_BANDS} value={bmi} min={14} max={40} label="bmi" />
              <div style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.55, marginTop: 4 }}>
                Set to Asia-Pacific cut-offs: the healthy band ends at 23, not 25.
              </div>
              <Btn
                style={{ marginTop: 16 }}
                onClick={() => {
                  setData((d) => ({ ...d, profile: { ...d.profile, heightCm: cm }, body: [{ id: uid(), ts: Date.now(), weightKg: kg }, ...d.body] }));
                  flash("Weight saved");
                }}
              >
                Save weight
              </Btn>
            </div>
          </>
        )}

        {tab === "sugar" && (
          <>
            <div style={{ paddingTop: 18 }}>
              <Seg value={kind} onChange={setKind} options={[{ value: "fasting", label: "Fasting" }, { value: "post", label: "After meal" }]} />
            </div>
            <Stepper label="Glucose" unit="mg/dL" value={mgdl} set={setMgdl} min={40} max={500} />
            <div style={{ paddingTop: 16 }}>
              <div className="flex items-center" style={{ gap: 9 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: classifySugar(mgdl, kind).color }} />
                <span style={{ fontSize: 15, fontWeight: 600 }}>{classifySugar(mgdl, kind).label}</span>
              </div>
              <Btn
                style={{ marginTop: 16 }}
                onClick={() => {
                  setData((d) => ({ ...d, sugar: [{ id: uid(), ts: Date.now(), mgdl, kind }, ...d.sugar] }));
                  flash("Reading saved");
                }}
              >
                Save reading
              </Btn>
            </div>
          </>
        )}
      </Card>

      <div style={{ padding: "26px 4px 10px" }}><Mono style={{ fontSize: 10.5 }}>History</Mono></div>
      {list.length === 0 ? (
        <Card><div style={{ fontSize: 14, color: C.ink2 }}>Nothing saved here yet.</div></Card>
      ) : (
        list.map((r) => (
          <div key={r.id} className="flex items-center justify-between" style={{ background: C.card, border: `1px solid ${C.hair}`, borderRadius: 16, padding: "14px 16px", backdropFilter: "blur(22px) saturate(140%)", marginBottom: 8 }}>
            <div className="flex items-center" style={{ gap: 13 }}>
              <span style={{ width: 3, height: 32, borderRadius: 99, background: r.cat.color }} />
              <div>
                <div className="flex items-baseline" style={{ gap: 5 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{r.main}</span>
                  <Mono>{r.unit}</Mono>
                  {r.sub && <Mono>· {r.sub}</Mono>}
                </div>
                <Mono style={{ display: "block", marginTop: 3 }}>{fmtDay(r.ts)} · {fmtTime(r.ts)} · {r.cat.label}</Mono>
              </div>
            </div>
            <button onClick={() => remove(r.id)} className="press" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.8" strokeLinecap="round">
                <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
              </svg>
            </button>
          </div>
        ))
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", background: C.panel, color: C.onPanel, padding: "12px 20px", borderRadius: 999, fontSize: 14, fontWeight: 600, zIndex: 40 }} className="rise">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── learn ───────────────────────────── */

const ARTICLES = [
  { t: "What the two numbers mean", d: "Systolic, diastolic, and which one decides", body: [
    "The upper number is the pressure while your heart pushes blood out. The lower one is the pressure while it refills between beats.",
    "A reading takes the higher of the two categories. 118/94 counts as high, even though the top number looks fine.",
    "One reading is not a diagnosis. Doctors read the pattern across days and weeks." ] },
  { t: "Measuring correctly at home", d: "Most high readings at home are technique", body: [
    "Sit quietly for five minutes first. Back supported, feet flat on the floor, legs uncrossed.",
    "Rest your arm on a table so the cuff sits level with your heart. Wrap it on bare skin, snug enough for two fingers underneath.",
    "No tea, coffee, tobacco or exercise for 30 minutes before. Empty your bladder first.",
    "Take two readings a minute apart and keep the average. Same times each day — morning before medicine, and evening." ] },
  { t: "Reading your BMI honestly", d: "Why the healthy band ends at 23 here", body: [
    "BMI is weight divided by height squared. It screens, it does not judge — it knows nothing about muscle or where fat sits.",
    "South Asians carry more visceral fat at the same BMI, so Indian and WHO Asia-Pacific guidance puts the healthy ceiling at 23 and obesity at 25.",
    "Waist size catches what BMI misses. Over 90 cm for men and 80 cm for women raises risk at any BMI." ] },
  { t: "Losing weight, realistically", d: "Why the first 5% is the one that counts", body: [
    "Losing 5 to 10% of your body weight is enough to move blood pressure, fasting sugar and triglycerides measurably. For an 80 kg person that is four to eight kilos — not a transformation, just a shift.",
    "Aim for a quarter to half a kilo a week. Faster than that and most of what goes is water and muscle, which is exactly what you want to keep.",
    "Protein and fibre at every meal do most of the work, because they keep you full: dal, rajma, chana, curd, paneer, eggs, fish, vegetables, whole grains. Liquid calories are the easy win — sweet chai four times a day, cold drinks, juice, alcohol.",
    "Weigh yourself once a week, same day, morning, after the toilet and before eating. Daily weight swings a kilo either way on salt and water alone, and watching that noise makes people quit.",
    "Plateaus are normal, not failure. Strength work twice a week protects muscle so the weight you lose is fat, and short sleep quietly pushes appetite up." ] },
  { t: "Salt, and where it hides", d: "The packet, not the shaker", body: [
    "Most sodium comes from processed food rather than cooking salt: papad, pickle, namkeen, biscuits, bread, instant noodles, sauces, restaurant meals.",
    "Cutting salt lowers pressure in most people within weeks. Aim under 5 g a day — about one level teaspoon in total.",
    "Check labels for sodium per 100 g. Above 600 mg per 100 g is high.",
    "Build flavour with lemon, tamarind, kokum, pepper, jeera, hing, curry leaves and coriander instead." ] },
  { t: "Foods that help", d: "Potassium, fibre, and a plate that works", body: [
    "Potassium blunts sodium: banana, coconut water, spinach, sweet potato, rajma, moong, curd, orange.",
    "Whole grains over refined — bajra, jowar, ragi, brown rice, whole wheat.",
    "Half the plate vegetables, a quarter protein, a quarter grain. Two fruits a day.",
    "With kidney disease the potassium advice changes — ask your doctor first." ] },
  { t: "Movement that lowers pressure", d: "Consistency beats intensity", body: [
    "Thirty minutes of brisk walking, cycling or swimming on most days lowers systolic pressure measurably within weeks.",
    "Add two days of light strength work. Isometric holds — a wall sit, a plank — perform well in trials.",
    "Never hold your breath while straining. Build up slowly after a long gap." ] },
  { t: "What your sugar numbers mean", d: "Fasting, after meals, and HbA1c", body: [
    "Fasting means eight hours with nothing but water. Under 100 mg/dL is normal, 100 to 125 is the pre-diabetes range, and 126 or above points to diabetes.",
    "Two hours after a meal, under 140 is normal, 140 to 199 is the pre-diabetes range, and 200 or above points to diabetes.",
    "HbA1c is different and more useful: it reflects your average sugar over roughly three months, so one bad day cannot skew it. Under 5.7% is normal, 5.7 to 6.4 is pre-diabetes, 6.5 and above is diabetes.",
    "A home glucometer screens, it does not diagnose. Diagnosis needs a lab test, usually repeated. Bring your home log to that appointment — the pattern is what helps.",
    "Pre-diabetes is the useful warning. A large share of people at that stage never progress if weight, food and movement change." ] },
  { t: "Eating for steadier sugar", d: "Order, portion and pairing", body: [
    "Total carbohydrate matters more than whether something tastes sweet. Two katoris of rice spike sugar more than one gulab jamun, which is not what most people expect.",
    "Never eat a carbohydrate naked. Rice with dal, curd and sabzi behaves very differently from rice alone, because protein, fat and fibre slow the rise.",
    "Order helps too: vegetables and protein first, grain last, in the same meal. Keep the roti and rice portion fixed and let dal and sabzi fill the plate.",
    "Whole fruit is fine — juice is not, since the fibre is gone and the sugar arrives all at once. Same for sweet chai, cold drinks and packaged fruit drinks.",
    "A ten to fifteen minute walk after your largest meal blunts the post-meal spike more reliably than almost anything else you can do for free. Skipping meals backfires; you eat more at the next one." ] },
  { t: "Why it starts earlier here", d: "Blood pressure, sugar and weight travel together", body: [
    "South Asians develop insulin resistance at a lower body weight than Europeans, and typically a decade earlier in life. Diabetes at a normal-looking BMI is common, which is why waist size and family history matter as much as the scale.",
    "The three conditions cluster. High blood pressure, high sugar, extra weight around the middle and abnormal lipids share the same underlying problem and tend to arrive as a group.",
    "That clustering works in your favour. The same changes — less salt and refined carbohydrate, more fibre and protein, thirty minutes of movement, a few kilos off the waist — move all of them at once.",
    "If diabetes or heart disease runs in your family, get screened earlier than you think you need to, and repeat it rather than testing once and forgetting." ] },
  { t: "What tobacco does to your vessels", d: "Cigarettes, bidi, gutka, khaini, hookah", body: [
    "Nicotine tightens your arteries and speeds the heart. One cigarette lifts blood pressure and pulse for roughly the next half hour, so a reading taken soon after smoking is not your real number.",
    "The long-term damage is structural. Smoke injures the lining of the blood vessels, stiffens them, lowers HDL and makes clots form more easily — which is why smoking multiplies the risk of heart attack and stroke rather than just adding to it.",
    "Chewing tobacco is not the safer option people assume. Gutka, khaini and zarda deliver nicotine straight through the mouth lining, raise blood pressure the same way, and carry their own risk of oral cancer. Hookah is not filtered by the water either — a single session runs far longer than one cigarette.",
    "Quitting works faster than most people expect. Pulse and pressure start falling within a day, circulation improves over weeks, and cardiovascular risk drops sharply across the first year. Nicotine gum or patches, a doctor's help, or India's toll-free national tobacco quitline all raise the odds of it sticking." ] },
  { t: "Alcohol and your numbers", d: "Dose matters more than type", body: [
    "Alcohol raises blood pressure in proportion to how much you drink. Regularly going past one or two drinks a day pushes both numbers up, and cutting back brings systolic pressure down by a few points within weeks.",
    "One standard drink is about 30 ml of spirits, 330 ml of beer, or 150 ml of wine. A large peg is two drinks, not one — most people undercount by half.",
    "There is a trap in the timing. Pressure often dips for a few hours after drinking, then rebounds higher overnight and into the next morning, which is when many people measure.",
    "Alcohol is also 7 calories a gram with no nutrition, so it drives weight and triglycerides up. It can drop blood sugar dangerously low overnight if you take diabetes medicine, and it amplifies dizziness from BP tablets.",
    "Heavy or binge drinking can trigger irregular heart rhythms even in people with healthy hearts." ] },
  { t: "Sleep, stress and the night", d: "Where a fifth of your pressure control lives", body: [
    "Blood pressure is meant to fall by 10–20% while you sleep. When it doesn't, cardiovascular risk rises — and short sleep, under about six hours a night, is linked to higher daytime pressure too.",
    "Loud snoring with pauses in breathing, morning headaches and daytime sleepiness point to sleep apnoea. It is one of the commonest reasons blood pressure refuses to come down despite medicine, and it is treatable — worth raising with your doctor.",
    "Stress causes real spikes, though the lasting damage comes more from what stress leads to: poor sleep, more tobacco and alcohol, skipped meals, no exercise.",
    "Slow breathing helps measurably. Six breaths a minute for five to ten minutes, done daily, lowers pressure a little and costs nothing." ] },
  { t: "When low pressure matters", d: "Hypotension, and what to do", body: [
    "Below 90/60 is low, but it only matters with symptoms: dizziness on standing, blurred vision, fainting, cold clammy skin, unusual fatigue.",
    "Usual causes are dehydration, heat, skipped meals, blood loss, and some medicines.",
    "Stand up slowly, drink more water, eat on time, skip long hot showers. Do not add salt on your own if you take BP medicine." ] },
  { t: "Warning signs to act on", d: "When to stop tracking and get help", body: [
    "Above 180/120 with chest pain, breathlessness, weakness on one side, slurred speech, severe headache or vision loss is an emergency. Call for help immediately — do not wait to re-measure.",
    "Above 180/120 without symptoms: rest five minutes, measure again, contact a doctor the same day.",
    "Fainting, repeated dizziness, or a resting pulse that stays very high or very low also needs a doctor." ] },
];

function Learn() {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ padding: "20px 16px 120px" }}>
      <Head title="Learn" caption={`${ARTICLES.length} reads · general information, not advice`} icon={G.learn(C.low)} tint={C.low} />
      <div>
        {ARTICLES.map((a, i) => (
          <div
            key={i}
            onClick={() => setOpen(open === i ? null : i)}
            style={{ background: C.card, border: `1px solid ${C.hair}`, backdropFilter: "blur(22px) saturate(140%)", borderRadius: 18, padding: 18, marginBottom: 8, cursor: "pointer" }}
          >
            <div className="flex items-start justify-between" style={{ gap: 14 }}>
              <div>
                <Mono style={{ fontSize: 9.5 }}>{String(i + 1).padStart(2, "0")}</Mono>
                <div style={{ fontSize: 16.5, fontWeight: 650, letterSpacing: "-0.025em", marginTop: 5 }}>{a.t}</div>
                <div style={{ fontSize: 13.5, color: C.ink2, marginTop: 3 }}>{a.d}</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round"
                style={{ marginTop: 20, transition: "transform 240ms ease", transform: open === i ? "rotate(180deg)" : "none", flexShrink: 0 }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            {open === i && (
              <div style={{ marginTop: 16, borderTop: `1px solid ${C.hair}`, paddingTop: 14 }} className="rise">
                {a.body.map((p, j) => (
                  <p key={j} style={{ fontSize: 14.5, lineHeight: 1.65, color: C.ink2, marginBottom: 11 }}>{p}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────── coach ───────────────────────────── */

const PROMPTS = [
  "Plan a low-salt day of meals for me",
  "Better evening snacks than namkeen",
  "What to eat before a fasting sugar test",
  "How much walking do I need this week?",
  "A 20-minute workout I can do at home",
  "Strength exercises without any gym",
];

function Coach({ data, setData }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  const msgs = data.chat;

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, busy]);

  const context = () => {
    const bp = data.bp[0], w = data.body[0], s = data.sugar[0];
    const bmi = bmiOf(w?.weightKg, data.profile.heightCm);
    const p = [];
    if (bp) p.push(`blood pressure ${bp.sys}/${bp.dia} mmHg (${classifyBP(bp.sys, bp.dia).label})`);
    if (bmi) p.push(`BMI ${bmi} on Asia-Pacific cut-offs, ${kg1(w.weightKg)} kg at ${data.profile.heightCm} cm`);
    if (s) p.push(`${s.kind === "fasting" ? "fasting" : "post-meal"} glucose ${s.mgdl} mg/dL`);
    if (data.profile.age) p.push(`age ${data.profile.age}`);
    p.push(`diet: ${data.profile.diet === "veg" ? "vegetarian" : data.profile.diet === "egg" ? "eggetarian" : "non-vegetarian"}`);
    return p.join("; ");
  };

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user", content: q }];
    setData((d) => ({ ...d, chat: next }));
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: `You are the food and movement coach inside a home vitals app used mainly in India. Recorded numbers for this person: ${context()}.

Rules:
- Practical guidance on food, exercise, sleep, stress and measurement technique. Use everyday Indian foods and measures (dal, roti, idli, poha, curd, sabzi, katori, tsp).
- For exercise, give something they can actually start: the activity, how long, how many days a week, and how to judge effort (able to talk but not sing). Prefer walking, stairs, cycling, bodyweight and household equipment over gym machines. Include a warm-up and a sensible progression when you set out a plan.
- Exercise safety: tell them to stop and rest for chest pain, severe breathlessness, dizziness or palpitations, and not to hold their breath while straining. If their pressure is in the stage 2 or crisis range, or they mention heart disease, pregnancy or a recent injury, say to get a doctor's clearance before starting anything vigorous.
- Never diagnose, never name or adjust medicines, never call a reading a disease. Send anything clinical to a doctor or dietitian.
- 120–180 words. Plain sentences, no markdown, no headers, no bold, no long lists. Be specific: name foods, portions, minutes and days.
- Outside food, movement, sleep, stress and measurement technique, say briefly that it needs a doctor.`,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const json = await res.json();
      const reply = (json.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
      setData((d) => ({ ...d, chat: [...next, { role: "assistant", content: reply || "That didn't come through. Send it again." }] }));
    } catch {
      setData((d) => ({ ...d, chat: [...next, { role: "assistant", content: "No connection to the coach. Check your network and send it again." }] }));
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>
      <div style={{ padding: "20px 20px 12px", borderBottom: `1px solid ${C.hair}` }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.035em" }}>AI coach</h1>
            <Mono style={{ display: "block", marginTop: 4 }}>Reads your numbers · food, movement, habits</Mono>
          </div>
          {msgs.length > 0 && (
            <button onClick={() => setData((d) => ({ ...d, chat: [] }))} className="press"
              style={{ border: `1px solid ${C.hair}`, background: C.card, borderRadius: 999, padding: "7px 13px", fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: C.ink2, cursor: "pointer", textTransform: "uppercase" }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1" style={{ overflowY: "auto", padding: "16px 16px 150px" }}>
        {msgs.length === 0 && (
          <>
            <div style={{ background: C.panelSoft, borderRadius: 18, padding: 18, marginBottom: 14 }}>
              <div style={{ color: C.onPanel2, fontSize: 14, lineHeight: 1.6 }}>
                Ask about meals, portions, salt, snacks, walking, workouts or sleep. The more you record, the more the answers are about you and not about everyone.
              </div>
            </div>
            {PROMPTS.map((p) => (
              <button key={p} onClick={() => send(p)} className="press"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: C.card, border: `1px solid ${C.hair}`, borderRadius: 16, padding: "15px 17px", marginBottom: 8, fontFamily: SANS, fontSize: 14.5, color: C.ink, cursor: "pointer" }}>
                {p}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            ))}
          </>
        )}

        {msgs.map((m, i) => (
          <div key={i} className="flex rise" style={{ justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div style={{
              maxWidth: "86%", padding: "14px 16px", fontSize: 14.5, lineHeight: 1.62, whiteSpace: "pre-wrap",
              background: m.role === "user" ? GRAD : C.card,
              color: m.role === "user" ? "#FFFFFF" : C.ink2,
              border: m.role === "user" ? "none" : `1px solid ${C.hair}`,
              backdropFilter: m.role === "user" ? "none" : "blur(22px) saturate(140%)",
              boxShadow: m.role === "user" ? "0 8px 22px rgba(167,139,250,0.32)" : "none",
              borderRadius: 18,
              borderBottomRightRadius: m.role === "user" ? 6 : 18,
              borderBottomLeftRadius: m.role === "user" ? 18 : 6,
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex" style={{ gap: 4, padding: "6px 4px" }}>
            {[0, 1, 2].map((i) => (
              <span key={i} className="dot" style={{ animationDelay: `${i * 140}ms`, width: 6, height: 6, borderRadius: 99, background: C.ink3, display: "inline-block" }} />
            ))}
          </div>
        )}
        <div ref={end} />
      </div>

      <div style={{ position: "fixed", bottom: 78, left: 0, right: 0, maxWidth: 430, margin: "0 auto", padding: "10px 16px 12px", background: C.paper }}>
        <div className="flex items-center" style={{ gap: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.hair}`, borderRadius: 16, padding: "5px 5px 5px 16px" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask about food, exercise or habits"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: SANS, fontSize: 15, color: C.ink, padding: "10px 0" }}
          />
          <button onClick={() => send()} disabled={busy || !input.trim()} className="press"
            style={{ background: GRAD, border: "none", borderRadius: 13, width: 42, height: 42, cursor: "pointer", opacity: busy || !input.trim() ? 0.3 : 1, display: "grid", placeItems: "center" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── report ───────────────────────────── */

const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
const within = (ts, days) => Date.now() - ts <= days * 864e5;

function buildReport(data) {
  const p = data.profile;
  const L = [];
  const pad = (s, n) => String(s).padEnd(n);
  const wNow = data.body[0]?.weightKg;
  const bmiNow = bmiOf(wNow, p.heightCm);

  L.push(`VITALS REPORT${p.name ? ` — ${p.name.toUpperCase()}` : ""}`);
  L.push(`Generated ${new Date().toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`);
  L.push("");
  L.push("PATIENT");
  L.push(`Name         ${p.name || "—"}`);
  L.push(`Age          ${p.age ? `${p.age} years` : "—"}`);
  L.push(`Sex          ${p.sex ? p.sex.charAt(0).toUpperCase() + p.sex.slice(1) : "—"}`);
  L.push(`Height       ${p.heightCm ? `${p.heightCm} cm` : "—"}`);
  L.push(`Weight       ${wNow ? `${kg1(wNow)} kg` : "—"}`);
  L.push(`BMI          ${bmiNow ? `${bmiNow}   ${classifyBMI(bmiNow).label}` : "—"}`);
  L.push(`Diet         ${p.diet === "veg" ? "Vegetarian" : p.diet === "egg" ? "Eggetarian" : "Non-vegetarian"}`);
  L.push("");

  const bp = data.bp;
  L.push(`BLOOD PRESSURE — ${bp.length} reading${bp.length === 1 ? "" : "s"}`);
  if (bp.length) {
    const last = bp[0];
    const w7 = bp.filter((r) => within(r.ts, 7));
    const w30 = bp.filter((r) => within(r.ts, 30));
    const inRange = bp.filter((r) => classifyBP(r.sys, r.dia).k === "normal").length;
    L.push(`Latest       ${last.sys}/${last.dia} mmHg   ${classifyBP(last.sys, last.dia).label}   ${fmtDay(last.ts)} ${fmtTime(last.ts)}`);
    if (w7.length) L.push(`7-day mean   ${avg(w7.map((r) => r.sys))}/${avg(w7.map((r) => r.dia))} mmHg   (${w7.length} readings)`);
    if (w30.length) L.push(`30-day mean  ${avg(w30.map((r) => r.sys))}/${avg(w30.map((r) => r.dia))} mmHg   (${w30.length} readings)`);
    L.push(`Spread       ${Math.min(...bp.map((r) => r.sys))}–${Math.max(...bp.map((r) => r.sys))} / ${Math.min(...bp.map((r) => r.dia))}–${Math.max(...bp.map((r) => r.dia))} mmHg`);
    L.push(`In range     ${inRange} of ${bp.length}`);
  } else L.push("No readings recorded.");
  L.push("");

  const b = data.body;
  L.push("BODY");
  if (b.length) {
    const bmi = bmiOf(b[0].weightKg, p.heightCm);
    L.push(`Latest       ${kg1(b[0].weightKg)} kg${bmi ? `   BMI ${bmi}   ${classifyBMI(bmi).label}` : ""}`);
    if (b.length > 1) {
      const d = +(b[0].weightKg - b[b.length - 1].weightKg).toFixed(1);
      L.push(`Change       ${d > 0 ? "+" : ""}${d} kg over ${b.length} entries`);
    }
    L.push("BMI read on WHO Asia-Pacific cut-offs (healthy 18.5–22.9).");
  } else L.push("No entries recorded.");
  L.push("");

  const s = data.sugar;
  L.push("BLOOD SUGAR");
  if (s.length) {
    const f = s.filter((r) => r.kind === "fasting"), pm = s.filter((r) => r.kind === "post");
    if (f.length) L.push(`Fasting      mean ${avg(f.map((r) => r.mgdl))} mg/dL   latest ${f[0].mgdl}   (${f.length})`);
    if (pm.length) L.push(`After meal   mean ${avg(pm.map((r) => r.mgdl))} mg/dL   latest ${pm[0].mgdl}   (${pm.length})`);
  } else L.push("No readings recorded.");
  L.push("");

  if (data.meds.length) {
    const t = data.medSettings?.times || {};
    const ad = adherence(data, 7);
    L.push("MEDICATIONS");
    data.meds.forEach((m) => {
      const when = m.slots.map((k) => `${slotOf(k).label} ${prettyTime(t[k] || slotOf(k).time)}`).join(", ");
      L.push(`${m.name}${m.dose ? ` — ${m.dose}` : ""}`);
      L.push(`   ${when}`);
    });
    if (ad.pct != null) L.push(`Doses taken as scheduled, last 7 days: ${ad.done} of ${ad.due} (${ad.pct}%)`);
    L.push("Patient-entered list. Not verified against a prescription.");
    L.push("");
  }

  if (bp.length) {
    L.push("PRESSURE LOG");
    L.push(`${pad("DATE", 11)}${pad("TIME", 7)}${pad("SYS/DIA", 10)}${pad("PULSE", 7)}CATEGORY`);
    bp.slice(0, 30).forEach((r) => {
      L.push(
        pad(new Date(r.ts).toLocaleDateString(undefined, { day: "2-digit", month: "short" }), 11) +
        pad(fmtTime(r.ts), 7) +
        pad(`${r.sys}/${r.dia}`, 10) +
        pad(r.pulse || "—", 7) +
        classifyBP(r.sys, r.dia).label
      );
    });
    L.push("");
  }

  L.push("Measured at home by the patient. Reference ranges follow ACC/AHA 2017.");
  L.push("Not a diagnosis.");
  return L.join("\n");
}

/* A print-ready sheet. Android's print dialog offers "Save as PDF",
   which is the most reliable route to a real file on the device. */
function buildReportHTML(data) {
  const p = data.profile;
  const wNow = data.body[0]?.weightKg;
  const bmiNow = bmiOf(wNow, p.heightCm);
  const bp = data.bp;
  const w30 = bp.filter((r) => within(r.ts, 30));
  const w7 = bp.filter((r) => within(r.ts, 7));
  const f = data.sugar.filter((r) => r.kind === "fasting");
  const pm = data.sugar.filter((r) => r.kind === "post");
  const row = (k, v) => (v ? `<tr><th>${k}</th><td>${v}</td></tr>` : "");

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Vitals report${p.name ? ` — ${p.name}` : ""}</title>
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
<h1>Vitals report${p.name ? ` — ${p.name}` : ""}</h1>
<div class="meta">Generated ${new Date().toLocaleString(undefined, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} · self-measured at home</div>

<h2>Patient</h2>
<table>
  ${row("Name", p.name || "—")}
  ${row("Age", p.age ? `${p.age} years` : "—")}
  ${row("Sex", p.sex ? p.sex.charAt(0).toUpperCase() + p.sex.slice(1) : "—")}
  ${row("Height", p.heightCm ? `${p.heightCm} cm` : "—")}
  ${row("Weight", wNow ? `${kg1(wNow)} kg` : "—")}
  ${row("BMI", bmiNow ? `${bmiNow} — ${classifyBMI(bmiNow).label}` : "—")}
  ${row("Diet", p.diet === "veg" ? "Vegetarian" : p.diet === "egg" ? "Eggetarian" : "Non-vegetarian")}
</table>

<h2>Blood pressure</h2>
<table>
  ${bp.length ? row("Latest", `${bp[0].sys}/${bp[0].dia} mmHg — ${classifyBP(bp[0].sys, bp[0].dia).label}, ${fmtDay(bp[0].ts).toLowerCase()} ${fmtTime(bp[0].ts)}`) : "<tr><td>No readings recorded.</td></tr>"}
  ${w7.length ? row("7-day mean", `${avg(w7.map((r) => r.sys))}/${avg(w7.map((r) => r.dia))} mmHg (${w7.length} readings)`) : ""}
  ${w30.length ? row("30-day mean", `${avg(w30.map((r) => r.sys))}/${avg(w30.map((r) => r.dia))} mmHg (${w30.length} readings)`) : ""}
  ${bp.length ? row("Spread", `${Math.min(...bp.map((r) => r.sys))}–${Math.max(...bp.map((r) => r.sys))} / ${Math.min(...bp.map((r) => r.dia))}–${Math.max(...bp.map((r) => r.dia))} mmHg`) : ""}
  ${bp.length ? row("In range", `${bp.filter((r) => classifyBP(r.sys, r.dia).k === "normal").length} of ${bp.length}`) : ""}
</table>

${data.sugar.length ? `<h2>Blood sugar</h2><table>
  ${f.length ? row("Fasting", `mean ${avg(f.map((r) => r.mgdl))} mg/dL, latest ${f[0].mgdl} (${f.length})`) : ""}
  ${pm.length ? row("After meal", `mean ${avg(pm.map((r) => r.mgdl))} mg/dL, latest ${pm[0].mgdl} (${pm.length})`) : ""}
</table>` : ""}

${data.meds.length ? `<h2>Medications</h2>
<table class="log"><thead><tr><th>Medicine</th><th>Dose</th><th>When</th></tr></thead><tbody>
${data.meds.map((m) => `<tr><td>${m.name}</td><td>${m.dose || "—"}</td><td>${m.slots.map((k) => `${slotOf(k).label} ${prettyTime((data.medSettings?.times || {})[k] || slotOf(k).time)}`).join("<br>")}</td></tr>`).join("")}
</tbody></table>
${adherence(data, 7).pct != null ? `<p style="font-size:11px;color:#666">Doses taken as scheduled, last 7 days: ${adherence(data, 7).done} of ${adherence(data, 7).due} (${adherence(data, 7).pct}%). Patient-entered list, not verified against a prescription.</p>` : ""}` : ""}

${bp.length ? `<h2>Pressure log</h2>
<table class="log"><thead><tr><th>Date</th><th>Time</th><th>Sys/Dia</th><th>Pulse</th><th>Category</th></tr></thead><tbody>
${bp.slice(0, 40).map((r) => `<tr><td>${new Date(r.ts).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}</td><td>${fmtTime(r.ts)}</td><td>${r.sys}/${r.dia}</td><td>${r.pulse || "—"}</td><td>${classifyBP(r.sys, r.dia).label}</td></tr>`).join("")}
</tbody></table>` : ""}

<div class="foot">Measured at home by the patient. Reference ranges follow ACC/AHA 2017; BMI uses WHO Asia-Pacific cut-offs. This is a record, not a diagnosis.</div>
</body></html>`;
}

/* A short version for messaging. WhatsApp and mailto links choke on
   very long URLs, so the full log stays in the PDF. */
function buildShareText(data) {
  const p = data.profile;
  const wNow = data.body[0]?.weightKg;
  const bmiNow = bmiOf(wNow, p.heightCm);
  const bp = data.bp;
  const w30 = bp.filter((r) => within(r.ts, 30));
  const L = [];

  L.push(`Vitals report${p.name ? ` — ${p.name}` : ""}`);
  L.push(new Date().toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }));
  L.push("");
  L.push(`Age ${p.age || "—"} · Height ${p.heightCm || "—"} cm · Weight ${wNow ? `${kg1(wNow)} kg` : "—"}${bmiNow ? ` · BMI ${bmiNow} (${classifyBMI(bmiNow).label})` : ""}`);
  L.push("");

  if (bp.length) {
    L.push("BLOOD PRESSURE");
    L.push(`Latest: ${bp[0].sys}/${bp[0].dia} mmHg — ${classifyBP(bp[0].sys, bp[0].dia).label}${bp[0].pulse ? `, pulse ${bp[0].pulse}` : ""}`);
    if (w30.length) L.push(`30-day mean: ${avg(w30.map((r) => r.sys))}/${avg(w30.map((r) => r.dia))} mmHg over ${w30.length} readings`);
    L.push(`In range: ${bp.filter((r) => classifyBP(r.sys, r.dia).k === "normal").length} of ${bp.length}`);
    L.push("");
    L.push("Recent readings");
    bp.slice(0, 8).forEach((r) =>
      L.push(`${new Date(r.ts).toLocaleDateString(undefined, { day: "2-digit", month: "short" })} ${fmtTime(r.ts)} — ${r.sys}/${r.dia}${r.pulse ? `, ${r.pulse} bpm` : ""}`)
    );
    if (bp.length > 8) L.push(`…and ${bp.length - 8} more`);
    L.push("");
  }

  const f = data.sugar.filter((r) => r.kind === "fasting");
  const pm = data.sugar.filter((r) => r.kind === "post");
  if (data.sugar.length) {
    L.push("BLOOD SUGAR");
    if (f.length) L.push(`Fasting: latest ${f[0].mgdl} mg/dL, mean ${avg(f.map((r) => r.mgdl))}`);
    if (pm.length) L.push(`After meal: latest ${pm[0].mgdl} mg/dL, mean ${avg(pm.map((r) => r.mgdl))}`);
    L.push("");
  }

  if (data.meds.length) {
    L.push("MEDICINES");
    data.meds.forEach((m) => L.push(`${m.name}${m.dose ? ` — ${m.dose}` : ""} · ${m.slots.map((k) => slotOf(k).label).join(", ")}`));
    L.push("");
  }

  L.push("Measured at home. Not a diagnosis.");
  return L.join("\n");
}

function openLink(url) {
  try {
    const w = window.open(url, "_blank", "noopener");
    if (w) return true;
  } catch {}
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {}
  return false;
}

function printDoc(html) {
  try {
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(f);
    const doc = f.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try {
        f.contentWindow.focus();
        f.contentWindow.print();
      } catch {}
      setTimeout(() => f.remove(), 60000);
    }, 350);
    return true;
  } catch {
    return false;
  }
}

async function shareFile(name, text, type) {
  try {
    const file = new File([text], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Vitals report" });
      return true;
    }
  } catch {}
  return false;
}

async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function saveFile(name, text, type = "text/plain") {
  try {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}

function ReportSheet({ data, onClose }) {
  const text = useMemo(() => buildReport(data), [data]);
  const short = useMemo(() => buildShareText(data), [data]);
  const [note, setNote] = useState("");
  const say = (m) => { setNote(m); setTimeout(() => setNote(""), 3000); };
  const doc = data.profile.docPhone ? data.profile.docPhone.replace(/\D/g, "") : "";
  const mail = data.profile.docEmail || "";
  const subject = `Vitals report${data.profile.name ? ` — ${data.profile.name}` : ""}`;

  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: subject, text: short });
        return say("Shared");
      }
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
    say((await copyText(short)) ? "Sharing unavailable — report copied, paste it into WhatsApp" : "Sharing unavailable here");
  };

  const toWhatsApp = () => {
    const url = `https://wa.me/${doc}?text=${encodeURIComponent(short)}`;
    if (!openLink(url)) say("Couldn't open WhatsApp — use Share instead");
    else if (!doc) say("Pick your doctor's chat in WhatsApp");
  };

  const toEmail = () => {
    const url = `mailto:${encodeURIComponent(mail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(short)}`;
    if (!openLink(url)) say("Couldn't open your mail app — use Share instead");
    else say("Attach the PDF if your doctor wants the full log");
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "linear-gradient(170deg, #3B1E8F 0%, #2B1B63 55%, #1E1B4B 100%)", display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto" }} className="rise">
      <div className="flex items-center justify-between" style={{ padding: "16px 18px", borderBottom: `1px solid ${C.hair}` }}>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.03em" }}>Report</h2>
          <Mono style={{ display: "block", marginTop: 3 }}>For your doctor</Mono>
        </div>
        <button onClick={onClose} className="press" style={{ border: `1px solid ${C.hair}`, background: C.card, borderRadius: 999, width: 36, height: 36, cursor: "pointer", display: "grid", placeItems: "center" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        <pre style={{
          fontFamily: MONO, fontSize: 11, lineHeight: 1.75, color: C.ink, background: C.card,
          border: `1px solid ${C.hair}`, borderRadius: 16, padding: 16, margin: 0,
          whiteSpace: "pre", overflowX: "auto",
        }}>
          {text}
        </pre>
      </div>

      <div style={{ padding: "12px 16px 20px", borderTop: `1px solid ${C.hair}`, background: C.paper }}>
        {note && <div style={{ fontSize: 13, color: C.ink2, textAlign: "center", marginBottom: 10, lineHeight: 1.45 }}>{note}</div>}

        <Btn onClick={nativeShare} style={{ padding: "15px 18px" }}>Share report</Btn>

        <div className="flex" style={{ gap: 8, marginTop: 8 }}>
          <Btn kind="quiet" onClick={toWhatsApp} style={{ padding: "13px 10px" }}>
            <span className="flex items-center justify-center" style={{ gap: 7 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.4L3.5 20.5l1.6-4.6A8.4 8.4 0 1 1 20.5 11.6z" />
                <path d="M8.9 9.1c.3 2.3 2.4 4.4 4.7 4.7l.9-1.2 1.7.8c-.3 1.1-1.4 1.6-2.5 1.4-2.7-.5-5-2.8-5.5-5.5-.2-1.1.3-2.2 1.4-2.5l.8 1.7z" />
              </svg>
              WhatsApp{doc ? "" : ""}
            </span>
          </Btn>
          <Btn kind="quiet" onClick={toEmail} style={{ padding: "13px 10px" }}>
            <span className="flex items-center justify-center" style={{ gap: 7 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5.5" width="18" height="13" rx="2" />
                <path d="M3.5 7l8.5 6 8.5-6" />
              </svg>
              Email
            </span>
          </Btn>
        </div>

        <div className="flex" style={{ gap: 8, marginTop: 8 }}>
          <Btn kind="quiet" style={{ padding: "13px 10px" }}
            onClick={() => say(printDoc(buildReportHTML(data)) ? "Choose “Save as PDF” in the print dialog" : "Printing is blocked here — use Share")}>
            Save as PDF
          </Btn>
          <Btn kind="quiet" style={{ padding: "13px 10px" }}
            onClick={async () => say((await copyText(text)) ? "Full report copied" : "Copy blocked. Select the text above instead.")}>
            Copy text
          </Btn>
        </div>

        <div style={{ marginTop: 10, textAlign: "center" }}>
          <button
            onClick={() => {
              const name = `vitals-data-${new Date().toISOString().slice(0, 10)}.json`;
              say(saveFile(name, JSON.stringify(data, null, 2), "application/json") ? "Saved to your downloads" : "Blocked here — use Copy text");
            }}
            style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.ink3 }}
          >
            Export raw data (.json)
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── profile ──────────────────────────── */

const fieldInput = {
  border: "none", outline: "none", background: "transparent", textAlign: "right",
  fontFamily: SANS, fontSize: 16, fontWeight: 600, color: C.ink, width: 150,
};

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "16px 0", borderBottom: `1px solid ${C.hair}` }}>
      <Mono>{label}</Mono>
      {children}
    </div>
  );
}

const SEXES = [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }];

function Profile({ data, setData, go }) {
  const [dialog, ask] = useAsk();
  const [report, setReport] = useState(false);
  const [family, setFamily] = useState(false);
  const [draft, setDraft] = useState(data.profile);
  const [note, setNote] = useState("");
  const saved = useRef(data.profile);

  /* Only re-seed the form when the stored profile changed somewhere
     other than this form — otherwise every keystroke would reset it. */
  useEffect(() => {
    if (JSON.stringify(saved.current) !== JSON.stringify(data.profile)) {
      saved.current = data.profile;
      setDraft(data.profile);
    }
  }, [data.profile]);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.profile);
  const save = () => {
    saved.current = draft;
    setData((d) => ({ ...d, profile: draft }));
    setNote("Profile saved");
    setTimeout(() => setNote(""), 1800);
  };

  const inp = fieldInput;
  const p = data.profile;
  const h = data.health || { conditions: [], allergies: "", bloodGroup: "" };
  const bp = data.bp[0];
  const w = data.body[0];
  const sugar = data.sugar[0];
  const bmi = bmiOf(w?.weightKg, p.heightCm);
  const ad = adherence(data, 7);
  const hist = data.history || [];
  const lastHist = hist.length ? [...hist].sort((a, b) => b.date - a.date)[0] : null;
  const byType = HISTORY_TYPES
    .map((t) => ({ t, n: hist.filter((r) => normType(r.type) === t.key).length }))
    .filter((x) => x.n > 0);
  const initials = (p.name || "").trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();

  /* One tile in the at-a-glance grid. */
  const Stat = ({ k, v, sub, color, onClick }) => (
    <div onClick={onClick} style={{ flex: 1, minWidth: 0, background: C.card, border: `1px solid ${C.hair}`,
      borderRadius: 18, padding: 15, backdropFilter: "blur(22px) saturate(140%)", cursor: onClick ? "pointer" : "default" }}>
      <Mono style={{ fontSize: 10 }}>{k}</Mono>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.04em", marginTop: 7, fontVariantNumeric: "tabular-nums" }}>{v}</div>
      {sub && <div style={{ fontSize: 12.5, fontWeight: 600, color: color || C.ink3, marginTop: 3 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      {dialog}
      <Head title="Profile" caption="who you are, and where you stand" icon={G.me(C.brand)} tint={C.brand} />

      {/* identity */}
      <Card style={{ padding: 20 }}>
        <div className="flex items-center" style={{ gap: 15 }}>
          <div style={{ width: 62, height: 62, borderRadius: 999, background: GRAD, color: "#FFFFFF",
            display: "grid", placeItems: "center", flexShrink: 0, fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {initials || "—"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
              {p.name || "Add your name"}
            </div>
            <div style={{ fontSize: 15, color: C.ink2, marginTop: 4 }}>
              {[p.age && `${p.age} years`, p.sex && SEXES.find((x) => x.value === p.sex)?.label,
                p.heightCm && `${p.heightCm} cm`, w && `${kg1(w.weightKg)} kg`].filter(Boolean).join(" · ") || "Details below"}
            </div>
          </div>
        </div>
        {(h.bloodGroup || h.allergies || h.conditions.length > 0) && (
          <div className="flex" style={{ gap: 6, flexWrap: "wrap", marginTop: 16 }}>
            {h.bloodGroup && (
              <span style={{ background: C.stage2, color: "#fff", borderRadius: 999, padding: "7px 13px",
                fontFamily: SANS, fontSize: 13, fontWeight: 700 }}>Blood {h.bloodGroup}</span>
            )}
            {h.allergies && (
              <span style={{ background: C.elevated, color: "#fff", borderRadius: 999, padding: "7px 13px",
                fontFamily: SANS, fontSize: 13, fontWeight: 600 }}>Allergy · {h.allergies}</span>
            )}
            {h.conditions.map((c) => (
              <span key={c} style={{ border: `1px solid ${C.hair}`, color: C.ink2, borderRadius: 999,
                padding: "7px 13px", fontFamily: SANS, fontSize: 13, fontWeight: 600 }}>{c}</span>
            ))}
          </div>
        )}
      </Card>

      {/* vitals at a glance */}
      <div style={{ padding: "22px 4px 10px" }}><Mono>Vitals at a glance</Mono></div>
      <div className="flex" style={{ gap: 8 }}>
        <Stat k="Pressure" v={bp ? `${bp.sys}/${bp.dia}` : "—"}
          sub={bp ? classifyBP(bp.sys, bp.dia).label : "not recorded"}
          color={bp ? classifyBP(bp.sys, bp.dia).color : null} onClick={() => go("log")} />
        <Stat k="BMI" v={bmi ?? "—"} sub={bmi ? classifyBMI(bmi).label : "add weight"}
          color={bmi ? classifyBMI(bmi).color : null} onClick={() => go("log")} />
      </div>
      <div className="flex" style={{ gap: 8, marginTop: 8 }}>
        <Stat k="Sugar" v={sugar ? sugar.mgdl : "—"}
          sub={sugar ? classifySugar(sugar.mgdl, sugar.kind).label : "not recorded"}
          color={sugar ? classifySugar(sugar.mgdl, sugar.kind).color : null} onClick={() => go("log")} />
        <Stat k="Medicines" v={ad.pct != null ? `${ad.pct}%` : "—"}
          sub={activeMeds(data).length ? `${activeMeds(data).length} active · 7 days` : "none active"}
          onClick={() => go("meds")} />
      </div>
      <div style={{ fontSize: 12.5, color: C.ink3, lineHeight: 1.5, padding: "10px 4px 0" }}>
        {data.bp.length} pressure · {data.body.length} weight · {data.sugar.length} sugar readings recorded.
      </div>

      {/* medical history summary */}
      <div style={{ padding: "22px 4px 10px" }}><Mono>Medical history</Mono></div>
      <Card style={{ padding: 20 }} onClick={() => go("history")}>
        {hist.length === 0 ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 600 }}>Nothing recorded yet</div>
            <div style={{ fontSize: 14.5, color: C.ink2, marginTop: 6, lineHeight: 1.5 }}>
              Add your past tests, diagnoses and procedures so they are in one place when a doctor asks.
            </div>
          </>
        ) : (
          <>
            <div className="flex items-baseline" style={{ gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.04em" }}>{hist.length}</span>
              <span style={{ fontSize: 15, color: C.ink2 }}>record{hist.length === 1 ? "" : "s"}</span>
            </div>
            <div className="flex" style={{ gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              {byType.map(({ t, n }) => (
                <span key={t.key} style={{ border: `1px solid ${t.color}`, color: t.color, borderRadius: 999,
                  padding: "6px 12px", fontFamily: SANS, fontSize: 12.5, fontWeight: 600 }}>
                  {n} {t.label.split(" ")[0].toLowerCase()}{n > 1 && t.key !== "other" ? "s" : ""}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 16, paddingTop: 6, borderTop: `1px solid ${C.hair}` }}>
              <Mono style={{ fontSize: 10, display: "block", padding: "10px 0 4px" }}>Most recent</Mono>
              {[...hist].sort((a, b) => b.date - a.date).slice(0, 4).map((r, i, arr) => {
                const d = new Date(r.date);
                return (
                  <div key={r.id} className="flex items-center" style={{ gap: 13, padding: "12px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.hair}` : "none" }}>
                    <span style={{ flexShrink: 0, textAlign: "center", width: 42 }}>
                      <span style={{ display: "block", fontSize: 19, fontWeight: 700, letterSpacing: "-0.03em" }}>{d.getDate()}</span>
                      <span style={{ display: "block", fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", color: C.ink3, textTransform: "uppercase" }}>
                        {d.toLocaleDateString(undefined, { month: "short" })} {String(d.getFullYear()).slice(2)}
                      </span>
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                      <span style={{ display: "block", fontSize: 13.5, color: C.ink3, marginTop: 2 }}>{typeOf(r.type).label}</span>
                    </span>
                    <span style={{ width: 30, height: 30, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center",
                      background: `${typeOf(r.type).color}2E`, border: `1px solid ${typeOf(r.type).color}4D` }}>
                      <TypeIcon k={r.type} color={typeOf(r.type).color} />
                    </span>
                  </div>
                );
              })}
              {hist.length > 4 && (
                <Mono style={{ display: "block", paddingTop: 12 }}>+{hist.length - 4} more in the timeline</Mono>
              )}
            </div>
          </>
        )}
        <Btn kind="quiet" style={{ marginTop: 16, padding: "16px", fontSize: 16 }} onClick={() => go("history")}>
          {hist.length ? "Open full timeline" : "Add a medical record"}
        </Btn>
      </Card>

      {/* details */}
      <div style={{ padding: "22px 4px 10px" }}><Mono>Your details</Mono></div>
      <Card style={{ paddingTop: 4, paddingBottom: 18 }}>
        <Row label="Name">
          <input value={draft.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Add name" style={inp} />
        </Row>
        <Row label="Age">
          <input value={draft.age || ""} inputMode="numeric" onChange={(e) => set("age", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="––" style={{ ...inp, width: 70 }} />
        </Row>
        <div style={{ padding: "16px 0", borderBottom: `1px solid ${C.hair}` }}>
          <Mono>Sex</Mono>
          <div style={{ marginTop: 10 }}>
            <Seg value={draft.sex || ""} onChange={(v) => set("sex", v)} options={SEXES} />
          </div>
        </div>
        <Row label="Height · cm">
          <input value={draft.heightCm || ""} inputMode="numeric" onChange={(e) => set("heightCm", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="––" style={{ ...inp, width: 70 }} />
        </Row>
        <Row label="Weight · kg">
          <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, color: w ? C.ink : C.ink3 }}>
            {w ? kg1(w.weightKg) : "record it"}
          </span>
        </Row>
        <Row label="Blood group">
          <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, color: h.bloodGroup ? C.ink : C.ink3 }}>
            {h.bloodGroup || "set in Health"}
          </span>
        </Row>
        <div style={{ padding: "16px 0 18px" }}>
          <Mono>Diet</Mono>
          <div style={{ marginTop: 10 }}>
            <Seg value={draft.diet || "veg"} onChange={(v) => set("diet", v)}
              options={[{ value: "veg", label: "Veg" }, { value: "egg", label: "Egg" }, { value: "nonveg", label: "Non-veg" }]} />
          </div>
        </div>
        <Btn onClick={save} disabled={!dirty} style={{ padding: "17px", fontSize: 16 }}>{dirty ? "Save profile" : note || "Saved"}</Btn>
        <div style={{ fontSize: 12.5, color: C.ink3, lineHeight: 1.5, marginTop: 12 }}>
          Weight comes from your latest reading. Blood group and conditions live in Health Summary.
        </div>
      </Card>

      <div style={{ padding: "22px 4px 10px" }}><Mono>Doctor</Mono></div>
      <Card style={{ paddingTop: 4, paddingBottom: 18 }}>
        <Row label="Doctor · WhatsApp">
          <input value={draft.docPhone || ""} inputMode="tel" onChange={(e) => set("docPhone", e.target.value.replace(/[^\d+]/g, "").slice(0, 15))} placeholder="+91…" style={{ ...inp, width: 130 }} />
        </Row>
        <Row label="Doctor · email">
          <input value={draft.docEmail || ""} inputMode="email" onChange={(e) => set("docEmail", e.target.value.trim())} placeholder="optional" style={inp} />
        </Row>
        <div style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.55, paddingTop: 14 }}>
          Fill these in and the report goes straight to your doctor. Include the country code.
        </div>
      </Card>

      <div style={{ padding: "22px 4px 10px" }}><Mono>More</Mono></div>
      <Card>
        <div className="flex" style={{ gap: 8 }}>
          <Btn kind="quiet" style={{ padding: "15px 10px", fontSize: 15 }} onClick={() => go && go("log")}>Record a reading</Btn>
          <Btn kind="quiet" style={{ padding: "15px 10px", fontSize: 15 }} onClick={() => go && go("learn")}>Learn</Btn>
        </div>
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Mono>This phone is</Mono>
        <div style={{ marginTop: 10 }}>
          <Seg
            value={data.care?.role || "logger"}
            onChange={(v) => setData((d) => ({ ...d, care: { ...(d.care || { circle: [], received: [], day: 0 }), role: v } }))}
            options={[{ value: "logger", label: "Logging" }, { value: "viewer", label: "Receiving" }]}
          />
        </div>
        <div style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.55, marginTop: 12 }}>
          Logging is the full app, for whoever takes the readings. Receiving is the family view — no logging, just the
          weekly updates that arrive by WhatsApp.
        </div>
        {(data.care?.role || "logger") === "logger" && (
          <Btn kind="quiet" style={{ marginTop: 14 }} onClick={() => setFamily(true)}>
            Family circle{data.care?.circle?.length ? ` · ${data.care.circle.length}` : ""}
          </Btn>
        )}
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Mono>Your data</Mono>
        <div style={{ fontSize: 14, color: C.ink2, margin: "10px 0 16px", lineHeight: 1.55 }}>
          {data.bp.length} pressure · {data.body.length} weight · {data.sugar.length} sugar · {data.meds.length} medicine{data.meds.length === 1 ? "" : "s"} · {hist.length} history record{hist.length === 1 ? "" : "s"}, held on this device.
        </div>
        <Btn onClick={() => setReport(true)} style={{ padding: "17px", fontSize: 16 }}>Open report</Btn>
        <Btn kind="quiet" style={{ marginTop: 8, color: C.stage2 }}
          onClick={async () => {
            const ok = await ask({
              title: "Delete every reading?",
              body: "All pressure, weight and sugar readings will be removed. Your medicines and medical history stay.",
              confirmLabel: "Delete readings", cancelLabel: "Cancel", danger: true,
            });
            if (ok) setData((d) => ({ ...d, bp: [], body: [], sugar: [], chat: [] }));
          }}>
          Delete all readings
        </Btn>
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Mono>Important</Mono>
        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: C.ink2, marginTop: 10 }}>
          This app records what you measure and explains the standard reference ranges. It does not diagnose, prescribe,
          or change medicines. Take your readings to your doctor — that is what they are for.
        </p>
      </Card>

      {report && <ReportSheet data={data} onClose={() => setReport(false)} />}
      {family && <FamilySheet data={data} setData={setData} onClose={() => setFamily(false)} />}
    </div>
  );
}


/* ─────────────────────────── medication ────────────────────────── */

const SLOTS = [
  { key: "empty",     label: "Empty stomach", sub: "before food",    time: "07:00" },
  { key: "breakfast", label: "After breakfast", sub: "with water",   time: "09:00" },
  { key: "lunch",     label: "After lunch",   sub: "",               time: "14:00" },
  { key: "dinner",    label: "After dinner",  sub: "",               time: "21:00" },
  { key: "bed",       label: "Bedtime",       sub: "",               time: "22:30" },
];

const slotOf = (k) => SLOTS.find((s) => s.key === k) || SLOTS[0];

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hhmmToMin = (t) => {
  const [h, m] = String(t || "00:00").split(":").map(Number);
  return h * 60 + m;
};

const prettyTime = (t) => {
  const [h, m] = String(t || "00:00").split(":").map(Number);
  const ap = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ap}`;
};

/* Every dose due today, in clock order. */
function dosesToday(data) {
  const times = data.medSettings?.times || {};
  const out = [];
  data.meds.filter((m) => (m.status || "active") === "active").forEach((med) =>
    med.slots.forEach((sk) => {
      const t = times[sk] || slotOf(sk).time;
      out.push({ id: `${med.id}|${sk}`, med, slot: sk, time: t, minutes: hhmmToMin(t) });
    })
  );
  return out.sort((a, b) => a.minutes - b.minutes);
}

const isTaken = (data, doseId, day = dayKey()) => Boolean(data.taken?.[day]?.[doseId]);

/* Adherence over the last n days, counting only days after a medicine was added. */
function adherence(data, days = 7) {
  const times = data.medSettings?.times || {};
  let due = 0, done = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const endOfDay = new Date(d).setHours(23, 59, 59, 999);
    data.meds.filter((m) => (m.status || "active") === "active").forEach((med) => {
      if (med.added > endOfDay) return;
      med.slots.forEach((sk) => {
        // today's later doses aren't late yet, so they don't count against you
        if (i === 0 && hhmmToMin(times[sk] || slotOf(sk).time) > new Date().getHours() * 60 + new Date().getMinutes()) return;
        due += 1;
        if (data.taken?.[key]?.[`${med.id}|${sk}`]) done += 1;
      });
    });
  }
  return { due, done, pct: due ? Math.round((done / due) * 100) : null };
}

/* Refill forecast. Stock burns down by the calendar, not by whether the
   user remembered to tick a dose — otherwise a missed tick would quietly
   report more medicine on hand than the box actually holds. */
const REFILL_ALERT_DAYS = 3;

const dailyUnits = (med) => (med.slots?.length || 0) * (med.perDose || 1);

function unitsLeft(med) {
  if (med.stock == null || !med.stockedAt) return null;
  const days = Math.max(0, Math.floor((Date.now() - med.stockedAt) / 864e5));
  return Math.max(0, +(med.stock - dailyUnits(med) * days).toFixed(2));
}

function daysLeft(med) {
  const left = unitsLeft(med);
  const per = dailyUnits(med);
  if (left == null || per <= 0) return null;
  return Math.floor(left / per);
}

const refillLabel = (d) =>
  d <= 0 ? "Out of stock" : d === 1 ? "1 day left" : `${d} days left`;

const refillColor = (d) => (d <= 1 ? C.stage2 : d <= 2 ? C.stage1 : C.elevated);

/* Meds at or under the alert threshold, soonest first. */
function refillsDue(data) {
  return data.meds
    .filter((m) => (m.status || "active") === "active")
    .map((m) => ({ med: m, days: daysLeft(m) }))
    .filter((x) => x.days != null && x.days <= REFILL_ALERT_DAYS)
    .sort((a, b) => a.days - b.days);
}

/* Fires reminders while the app is open. A real background alarm needs
   the native build — see the note on the Meds screen. */
function useReminders(data) {
  const [state, setState] = useState({ doses: [], refills: [] });
  const fired = useRef(new Set());

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const lead = data.medSettings?.lead ?? 10;
      const doses = dosesToday(data).filter((d) => {
        if (isTaken(data, d.id)) return false;
        return nowMin >= d.minutes - lead && nowMin <= d.minutes + 90;
      });
      const refills = refillsDue(data);
      setState({ doses, refills });

      const canNotify =
        data.medSettings?.notify && typeof Notification !== "undefined" && Notification.permission === "granted";
      if (!canNotify) return;

      doses.forEach((d) => {
        const stamp = `${dayKey()}|${d.id}`;
        if (fired.current.has(stamp)) return;
        fired.current.add(stamp);
        try {
          new Notification(`${d.med.name}${d.med.dose ? ` · ${d.med.dose}` : ""}`, {
            body: `${slotOf(d.slot).label} · ${prettyTime(d.time)}`,
            tag: stamp,
          });
        } catch {}
      });

      // one refill notification per medicine per day, at 3, 2, 1 and 0 days
      refills.forEach(({ med, days }) => {
        const stamp = `refill|${dayKey()}|${med.id}`;
        if (fired.current.has(stamp)) return;
        fired.current.add(stamp);
        try {
          new Notification(`${med.name} — ${refillLabel(days).toLowerCase()}`, {
            body: days <= 0 ? "You have run out. Buy a refill today." : "Time to buy a refill.",
            tag: stamp,
          });
        } catch {}
      });
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, [data]);

  return state;
}

function Meds({ data, setData }) {
  const [dialog, ask] = useAsk();
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [picked, setPicked] = useState([]);
  const [stock, setStock] = useState("");
  const [perDose, setPerDose] = useState("1");
  const [adding, setAdding] = useState(false);
  const [restock, setRestock] = useState(null);   // medId being topped up
  const [restockQty, setRestockQty] = useState("");
  const [editTimes, setEditTimes] = useState(false);
  const [note, setNote] = useState("");

  const settings = data.medSettings || { times: {}, lead: 10, notify: false };
  const times = { ...Object.fromEntries(SLOTS.map((s) => [s.key, s.time])), ...(settings.times || {}) };
  const doses = dosesToday(data);
  const adh = adherence(data, 7);
  const say = (m) => { setNote(m); setTimeout(() => setNote(""), 2600); };

  const setSettings = (patch) =>
    setData((d) => ({ ...d, medSettings: { ...settings, ...patch } }));

  const toggleSlot = (k) =>
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const addMed = () => {
    if (!name.trim() || !picked.length) return;
    setData((d) => ({
      ...d,
      meds: [...d.meds, {
        id: uid(), name: name.trim(), dose: dose.trim(), slots: picked, added: Date.now(), status: "active",
        perDose: Math.max(1, +perDose || 1),
        stock: stock === "" ? null : +stock,
        stockedAt: stock === "" ? null : Date.now(),
      }],
    }));
    setName(""); setDose(""); setPicked([]); setStock(""); setPerDose("1"); setAdding(false);
    say("Medicine added");
  };

  /* Stopping is not deleting. The medicine keeps its record and moves
     out of today's schedule, current medications and the summary. */
  const setStatus = async (id, status) => {
    const med = data.meds.find((m) => m.id === id);
    if (status === "discontinued") {
      const why = await ask({
        title: `Stop ${med.name}?`,
        body: "It moves out of today's doses and your health summary, but stays in your medicine record.",
        input: true, placeholder: "Reason — optional",
        confirmLabel: "Stop this medicine", cancelLabel: "Keep taking", danger: true,
      });
      if (why === null) return;
      setData((d) => ({ ...d, meds: d.meds.map((m) => (m.id === id ? { ...m, status, stoppedAt: Date.now(), stopReason: why || "" } : m)) }));
      say(`${med.name} stopped. It stays in your medicine record.`);
      return;
    }
    setData((d) => ({ ...d, meds: d.meds.map((m) => (m.id === id ? { ...m, status } : m)) }));
    say(status === "paused" ? `${med.name} paused` : `${med.name} is active again`);
  };

  const removeMed = async (id) => {
    const ok = await ask({
      title: "Delete this medicine completely?",
      body: "Stopping it instead keeps the record of when you took it. Deleting removes it entirely.",
      confirmLabel: "Delete", cancelLabel: "Cancel", danger: true,
    });
    if (!ok) return;
    setData((d) => ({ ...d, meds: d.meds.filter((m) => m.id !== id) }));
  };

  const saveRestock = (id) => {
    const qty = +restockQty;
    if (!qty || qty <= 0) return;
    setData((d) => ({
      ...d,
      meds: d.meds.map((m) => (m.id === id ? { ...m, stock: qty, stockedAt: Date.now() } : m)),
    }));
    setRestock(null); setRestockQty("");
    say("Stock updated");
  };

  const toggleTaken = (doseId) => {
    const day = dayKey();
    setData((d) => {
      const dayMap = { ...(d.taken?.[day] || {}) };
      if (dayMap[doseId]) delete dayMap[doseId];
      else dayMap[doseId] = Date.now();
      return { ...d, taken: { ...(d.taken || {}), [day]: dayMap } };
    });
  };

  const askNotify = async () => {
    if (typeof Notification === "undefined") return say("This browser has no notification support");
    try {
      const res = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (res === "granted") { setSettings({ notify: true }); say("Reminders on"); }
      else say("Permission denied — reminders will show inside the app only");
    } catch {
      say("Notifications are blocked here — the in-app reminder still works");
    }
  };

  const grouped = SLOTS.map((s) => ({ slot: s, items: doses.filter((d) => d.slot === s.key) })).filter((g) => g.items.length);

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      {dialog}
      <Head
        title="Medicines"
        icon={G.meds(C.mint)} tint={C.mint}
        caption={data.meds.length ? `${doses.length} doses today` : "Nothing added yet"}
        right={adh.pct != null && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>{adh.pct}%</div>
            <Mono>7-day · {adh.done}/{adh.due}</Mono>
          </div>
        )}
      />

      {note && (
        <div style={{ marginTop: 14, background: C.panelSoft, color: C.onPanel2, borderRadius: 14, padding: "12px 16px", fontSize: 13.5 }}>{note}</div>
      )}

      {/* today's schedule */}
      {grouped.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {grouped.map(({ slot, items }) => (
            <div key={slot.key} style={{ marginBottom: 12 }}>
              <div className="flex items-center justify-between" style={{ padding: "0 4px 8px" }}>
                <Mono>{slot.label}</Mono>
                <Mono>{prettyTime(times[slot.key])}</Mono>
              </div>
              {items.map((d) => {
                const done = isTaken(data, d.id);
                return (
                  <div key={d.id} className="flex items-center justify-between"
                    style={{ background: C.card, border: `1px solid ${C.hair}`, backdropFilter: "blur(22px) saturate(140%)", borderRadius: 16, padding: "13px 15px", marginBottom: 6 }}>
                    <div className="flex items-center" style={{ gap: 12, minWidth: 0 }}>
                      <button onClick={() => toggleTaken(d.id)} className="press" aria-label="mark taken"
                        style={{
                          width: 30, height: 30, borderRadius: 999, flexShrink: 0, cursor: "pointer",
                          border: done ? "none" : `1.5px solid ${C.hair}`,
                          background: done ? "linear-gradient(135deg, #4ADE80 0%, #22B8A6 100%)" : "rgba(255,255,255,0.08)", display: "grid", placeItems: "center",
                        }}>
                        {done && (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#08221A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                        )}
                      </button>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.02em",
                          color: done ? C.ink3 : C.ink, textDecoration: done ? "line-through" : "none",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {d.med.name}
                        </div>
                        {d.med.dose && <Mono style={{ display: "block", marginTop: 2 }}>{d.med.dose}</Mono>}
                      </div>
                    </div>
                    <div className="flex" style={{ gap: 4, flexShrink: 0 }}>
                      <button onClick={() => setStatus(d.med.id, "paused")} className="press" title="pause"
                        style={{ border: "none", background: "transparent", cursor: "pointer", padding: 8 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round"><path d="M9 5v14M15 5v14" /></svg>
                      </button>
                      <button onClick={() => setStatus(d.med.id, "discontinued")} className="press" title="stop this medicine"
                        style={{ border: "none", background: "transparent", cursor: "pointer", padding: 8 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.8" strokeLinecap="round"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* add */}
      {adding ? (
        <Card style={{ marginTop: 4 }}>
          <Mono>Medicine name</Mono>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Telmisartan"
            style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: SANS,
              fontSize: 20, fontWeight: 600, color: C.ink, marginTop: 8, paddingBottom: 8, borderBottom: `2px solid ${C.hair}` }} />
          <div style={{ marginTop: 18 }}>
            <Mono>Dose — optional</Mono>
            <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="40 mg · 1 tablet"
              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: SANS,
                fontSize: 16, fontWeight: 500, color: C.ink, marginTop: 8, paddingBottom: 8, borderBottom: `2px solid ${C.hair}` }} />
          </div>
          <div className="flex" style={{ gap: 14, marginTop: 18 }}>
            <div style={{ flex: 1 }}>
              <Mono>Tablets in hand</Mono>
              <input value={stock} inputMode="numeric" onChange={(e) => setStock(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="optional"
                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: SANS,
                  fontSize: 16, fontWeight: 600, color: C.ink, marginTop: 8, paddingBottom: 8, borderBottom: `2px solid ${C.hair}` }} />
            </div>
            <div style={{ width: 92 }}>
              <Mono>Per dose</Mono>
              <input value={perDose} inputMode="numeric" onChange={(e) => setPerDose(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="1"
                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: SANS,
                  fontSize: 16, fontWeight: 600, color: C.ink, marginTop: 8, paddingBottom: 8, borderBottom: `2px solid ${C.hair}` }} />
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5, marginTop: 8 }}>
            Fill these in and you'll be warned 3, 2 and 1 days before the strip runs out.
          </div>

          <div style={{ marginTop: 20 }}>
            <Mono>When do you take it</Mono>
            <div style={{ marginTop: 10 }}>
              {SLOTS.map((s) => {
                const on = picked.includes(s.key);
                return (
                  <button key={s.key} onClick={() => toggleSlot(s.key)} className="press"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                      background: on ? GRAD : "rgba(255,255,255,0.10)", color: on ? "#FFFFFF" : C.ink,
                      border: `1px solid ${on ? "transparent" : C.hair}`, borderRadius: 14,
                      padding: "13px 15px", marginBottom: 6, cursor: "pointer", fontFamily: SANS, fontSize: 14.5, fontWeight: 600,
                    }}>
                    <span>{s.label}{s.sub ? <span style={{ fontWeight: 400, opacity: 0.6 }}> · {s.sub}</span> : ""}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", opacity: 0.75 }}>{prettyTime(times[s.key])}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex" style={{ gap: 8, marginTop: 16 }}>
            <Btn kind="quiet" onClick={() => { setAdding(false); setName(""); setDose(""); setPicked([]); }}>Cancel</Btn>
            <Btn onClick={addMed} disabled={!name.trim() || !picked.length}>Add medicine</Btn>
          </div>
        </Card>
      ) : (
        <Btn onClick={() => setAdding(true)} style={{ marginTop: 4 }}>Add a medicine</Btn>
      )}

      {/* not currently taken */}
      {data.meds.some((m) => (m.status || "active") !== "active") && (
        <Card style={{ marginTop: 10 }}>
          <Mono>Not taking now</Mono>
          <div style={{ fontSize: 13, color: C.ink2, margin: "8px 0 4px", lineHeight: 1.5 }}>
            Kept in your record. These never appear in today's doses or your health summary.
          </div>
          {data.meds.filter((m) => (m.status || "active") !== "active").map((m) => (
            <div key={m.id} className="flex items-center justify-between" style={{ padding: "14px 0", borderBottom: `1px solid ${C.hair}`, gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 600, color: C.ink2, letterSpacing: "-0.02em" }}>{m.name}</div>
                <Mono style={{ display: "block", marginTop: 3 }}>
                  {m.status}{m.stoppedAt ? ` · ${fmtDay(m.stoppedAt).toLowerCase()}` : ""}{m.stopReason ? ` · ${m.stopReason}` : ""}
                </Mono>
              </div>
              <button onClick={() => setStatus(m.id, "active")} className="press"
                style={{ border: `1px solid ${C.hair}`, background: C.card, borderRadius: 999, padding: "9px 15px",
                  fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.ink, cursor: "pointer", flexShrink: 0 }}>
                Start again
              </button>
            </div>
          ))}
        </Card>
      )}

      {/* stock */}
      {activeMeds(data).length > 0 && (
        <Card style={{ marginTop: 10 }}>
          <Mono>Stock and refills</Mono>
          {activeMeds(data).map((m) => {
            const dl = daysLeft(m);
            const left = unitsLeft(m);
            const low = dl != null && dl <= REFILL_ALERT_DAYS;
            return (
              <div key={m.id} style={{ padding: "14px 0", borderBottom: `1px solid ${C.hair}` }}>
                <div className="flex items-center justify-between" style={{ gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                    {dl == null ? (
                      <Mono style={{ display: "block", marginTop: 3 }}>No stock tracked</Mono>
                    ) : (
                      <div className="flex items-center" style={{ gap: 7, marginTop: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 99, background: low ? refillColor(dl) : C.normal }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: low ? refillColor(dl) : C.ink2 }}>{refillLabel(dl)}</span>
                        <Mono>≈ {left} left · {dailyUnits(m)}/day</Mono>
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setRestock(restock === m.id ? null : m.id); setRestockQty(""); }} className="press"
                    style={{ border: `1px solid ${C.hair}`, background: C.card, borderRadius: 999, padding: "8px 14px",
                      fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.ink, cursor: "pointer", flexShrink: 0 }}>
                    {dl == null ? "Set stock" : "Bought more"}
                  </button>
                </div>
                {restock === m.id && (
                  <div className="flex items-center rise" style={{ gap: 8, marginTop: 12 }}>
                    <input value={restockQty} inputMode="numeric" autoFocus placeholder="How many tablets now?"
                      onChange={(e) => setRestockQty(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      onKeyDown={(e) => e.key === "Enter" && saveRestock(m.id)}
                      style={{ flex: 1, border: `1px solid ${C.hair}`, borderRadius: 12, padding: "11px 13px",
                        fontFamily: SANS, fontSize: 15, color: C.ink, outline: "none", background: C.card }} />
                    <button onClick={() => saveRestock(m.id)} className="press" disabled={!restockQty}
                      style={{ background: C.panel, color: C.onPanel, border: "none", borderRadius: 12, padding: "11px 16px",
                        fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: restockQty ? 1 : 0.35 }}>
                      Save
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.55, paddingTop: 12 }}>
            Counted down by the calendar from the day you set the stock, so it stays honest even if you forget to tick a dose.
          </div>
        </Card>
      )}

      {/* reminders */}
      <Card style={{ marginTop: 10 }}>
        <div className="flex items-center justify-between">
          <Mono>Reminders</Mono>
          <Mono>{settings.notify ? "on" : "off"}</Mono>
        </div>

        <div style={{ marginTop: 14 }}>
          <Mono>Remind me before the dose</Mono>
          <div style={{ marginTop: 10 }}>
            <Seg
              value={String(settings.lead ?? 10)}
              onChange={(v) => setSettings({ lead: +v })}
              options={[
                { value: "0", label: "On time" },
                { value: "5", label: "5 min" },
                { value: "10", label: "10 min" },
                { value: "30", label: "30 min" },
              ]}
            />
          </div>
        </div>

        <Btn kind={settings.notify ? "quiet" : "solid"} style={{ marginTop: 16 }}
          onClick={() => (settings.notify ? (setSettings({ notify: false }), say("Reminders off")) : askNotify())}>
          {settings.notify ? "Turn reminders off" : "Turn on notifications"}
        </Btn>

        <div style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.55, marginTop: 14 }}>
          Covers both dose times and refill warnings at 3, 2 and 1 days before a medicine runs out. Reminders arrive
          while the app is open — alerts that wake the phone with the app closed need the installed Android app.
        </div>
      </Card>

      {/* dose times */}
      <Card style={{ marginTop: 10 }}>
        <button onClick={() => setEditTimes((v) => !v)}
          className="flex items-center justify-between press"
          style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
          <Mono>Your dose times</Mono>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round"
            style={{ transition: "transform 220ms ease", transform: editTimes ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {editTimes ? (
          <div style={{ marginTop: 8 }}>
            {SLOTS.map((s) => (
              <div key={s.key} className="flex items-center justify-between"
                style={{ padding: "13px 0", borderBottom: `1px solid ${C.hair}` }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{s.label}</div>
                  {s.sub && <Mono style={{ display: "block", marginTop: 2 }}>{s.sub}</Mono>}
                </div>
                <input type="time" value={times[s.key]}
                  onChange={(e) => setSettings({ times: { ...times, [s.key]: e.target.value } })}
                  style={{ border: `1px solid ${C.hair}`, borderRadius: 10, padding: "8px 10px",
                    fontFamily: MONO, fontSize: 13, color: C.ink, background: "rgba(255,255,255,0.10)" }} />
              </div>
            ))}
            <div style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.55, paddingTop: 12 }}>
              Set these to when you actually eat. Every reminder is calculated from them.
            </div>
          </div>
        ) : (
          <div className="flex" style={{ gap: 14, flexWrap: "wrap", marginTop: 10 }}>
            {SLOTS.map((s) => (
              <div key={s.key}>
                <Mono style={{ fontSize: 9.5 }}>{s.label.split(" ").pop()}</Mono>
                <div style={{ fontSize: 13.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{prettyTime(times[s.key])}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Mono>Important</Mono>
        <p style={{ fontSize: 13, lineHeight: 1.65, color: C.ink2, marginTop: 10 }}>
          This is a reminder list you control. It does not check doses, interactions or timing — only your doctor or
          pharmacist can do that. Never start, stop or change a medicine because of anything in this app.
        </p>
      </Card>
    </div>
  );
}

/* ────────────────────────── care circle ────────────────────────── */
/* No backend. The parent's phone is the database; the weekly update
   leaves as a WhatsApp message, and the family member's copy of the
   app is a reader for what arrives. */

const RELATIONS = ["Son", "Daughter", "Spouse", "Sibling", "Caregiver"];

function weekWindow() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const f = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return { start, end, label: `${f(start)}–${f(end)}` };
}

function missedDoses(data, days = 7) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const endOfDay = new Date(d).setHours(23, 59, 59, 999);
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    data.meds.filter((m) => (m.status || "active") === "active").forEach((med) => {
      if (med.added > endOfDay) return;
      med.slots.forEach((sk) => {
        const t = (data.medSettings?.times || {})[sk] || slotOf(sk).time;
        if (i === 0 && hhmmToMin(t) > nowMin) return;
        if (!data.taken?.[key]?.[`${med.id}|${sk}`])
          out.push(`${med.name}, ${slotOf(sk).label.toLowerCase()} on ${d.toLocaleDateString(undefined, { weekday: "short" })}`);
      });
    });
  }
  return out;
}

function buildWeekly(data) {
  const { label } = weekWindow();
  const since = Date.now() - 7 * 864e5;
  const bp = data.bp.filter((r) => r.ts >= since);
  const sugar = data.sugar.filter((r) => r.ts >= since);
  const body = data.body.filter((r) => r.ts >= since);
  const ad = adherence(data, 7);
  const missed = missedDoses(data);
  const L = [];
  const who = data.profile.name || "Weekly update";

  L.push(`${who} — weekly update`);
  L.push(label);
  L.push("");

  if (bp.length) {
    const high = bp.filter((r) => r.sys >= 140 || r.dia >= 90);
    const worst = [...bp].sort((a, b) => b.sys - a.sys)[0];
    L.push(`Blood pressure: ${bp.length} reading${bp.length === 1 ? "" : "s"}, average ${avg(bp.map((r) => r.sys))}/${avg(bp.map((r) => r.dia))}.`);
    L.push(`Highest ${worst.sys}/${worst.dia} on ${new Date(worst.ts).toLocaleDateString(undefined, { weekday: "long" })}.`);
    if (high.length) L.push(`${high.length} of ${bp.length} above 140/90.`);
  } else {
    L.push("Blood pressure: nothing recorded this week.");
  }
  L.push("");

  if (data.meds.length) {
    L.push(`Medicines: ${ad.done} of ${ad.due} doses taken${ad.pct != null ? ` (${ad.pct}%)` : ""}.`);
    if (missed.length) L.push(`Missed: ${missed.slice(0, 3).join("; ")}${missed.length > 3 ? `; +${missed.length - 3} more` : ""}.`);
    const low = refillsDue(data);
    if (low.length) L.push(`Running out: ${low.map((r) => `${r.med.name} (${refillLabel(r.days).toLowerCase()})`).join(", ")}.`);
    L.push("");
  }

  if (body.length) {
    const latest = body[0], oldest = body[body.length - 1];
    const diff = +(latest.weightKg - oldest.weightKg).toFixed(1);
    L.push(`Weight: ${kg1(latest.weightKg)} kg${body.length > 1 ? ` (${diff > 0 ? "+" : ""}${diff} this week)` : ""}.`);
  }
  if (sugar.length) {
    const f = sugar.filter((r) => r.kind === "fasting");
    if (f.length) L.push(`Fasting sugar: average ${avg(f.map((r) => r.mgdl))} mg/dL over ${f.length}.`);
  }
  if (body.length || sugar.length) L.push("");

  const flags = [];
  if (bp.filter((r) => r.sys >= 140 || r.dia >= 90).length >= 3) flags.push("several readings above target");
  if (ad.pct != null && ad.pct < 80) flags.push("doses being missed");
  if (!bp.length) flags.push("no readings taken");
  if (refillsDue(data).length) flags.push("a medicine about to run out");
  if (flags.length) L.push(`Worth a call about: ${flags.join(", ")}.`);

  L.push("Measured at home. Not a diagnosis.");
  return L.join("\n");
}

/* Sunday by default. Due once the chosen day arrives and nothing has
   been sent since the start of that day. */
function weeklyDue(data) {
  const care = data.care || {};
  if (!care.circle?.length) return false;
  const day = care.day ?? 0;
  const now = new Date();
  const lastDue = new Date();
  lastDue.setDate(now.getDate() - ((now.getDay() - day + 7) % 7));
  lastDue.setHours(0, 0, 0, 0);
  return care.circle.some((m) => m.weekly && (!m.lastSent || m.lastSent < lastDue.getTime()));
}

function FamilySheet({ data, setData, onClose }) {
  const care = data.care || { role: "logger", circle: [], day: 0 };
  const [name, setName] = useState("");
  const [rel, setRel] = useState("Son");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const text = useMemo(() => buildWeekly(data), [data]);
  const say = (m) => { setNote(m); setTimeout(() => setNote(""), 2800); };
  const setCare = (patch) => setData((d) => ({ ...d, care: { ...care, ...patch } }));

  const add = () => {
    if (!name.trim()) return;
    setCare({ circle: [...care.circle, { id: uid(), name: name.trim(), rel, phone: phone.replace(/[^\d+]/g, ""), weekly: true, lastSent: null }] });
    setName(""); setPhone("");
    say("Added to the circle");
  };

  const send = (m) => {
    const msg = `${text}\n\nSent from my vitals app.`;
    const ok = openLink(`https://wa.me/${(m.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`);
    if (!ok) return say("Couldn't open WhatsApp");
    setCare({ circle: care.circle.map((x) => (x.id === m.id ? { ...x, lastSent: Date.now() } : x)) });
  };

  const sendAll = () => {
    const first = care.circle.filter((m) => m.weekly)[0];
    if (first) send(first);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "linear-gradient(170deg, #3B1E8F 0%, #2B1B63 55%, #1E1B4B 100%)", display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto" }} className="rise">
      <div className="flex items-center justify-between" style={{ padding: "16px 18px", borderBottom: `1px solid ${C.hair}` }}>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.03em" }}>Family</h2>
          <Mono style={{ display: "block", marginTop: 3 }}>Weekly update by WhatsApp</Mono>
        </div>
        <button onClick={onClose} className="press" style={{ border: `1px solid ${C.hair}`, background: C.card, borderRadius: 999, width: 36, height: 36, cursor: "pointer", display: "grid", placeItems: "center" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {note && <div style={{ background: C.panelSoft, color: C.onPanel2, borderRadius: 14, padding: "12px 15px", fontSize: 13.5, marginBottom: 12 }}>{note}</div>}

        <Card>
          <Mono>Who gets the update</Mono>
          {care.circle.length === 0 && (
            <div style={{ fontSize: 14, color: C.ink2, marginTop: 10, lineHeight: 1.55 }}>
              Nobody yet. Add a family member and their weekly summary goes out over WhatsApp — no account, no server, nothing stored anywhere but this phone.
            </div>
          )}
          {care.circle.map((m) => (
            <div key={m.id} style={{ padding: "14px 0", borderBottom: `1px solid ${C.hair}` }}>
              <div className="flex items-center justify-between" style={{ gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.02em" }}>{m.name}</div>
                  <Mono style={{ display: "block", marginTop: 3 }}>
                    {m.rel}{m.phone ? ` · ${m.phone}` : " · no number"} · {m.lastSent ? `sent ${fmtDay(m.lastSent).toLowerCase()}` : "never sent"}
                  </Mono>
                </div>
                <div className="flex items-center" style={{ gap: 6, flexShrink: 0 }}>
                  <button onClick={() => send(m)} className="press"
                    style={{ background: C.panel, color: C.onPanel, border: "none", borderRadius: 999, padding: "9px 15px", fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Send
                  </button>
                  <button onClick={() => setCare({ circle: care.circle.filter((x) => x.id !== m.id) })} className="press"
                    style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.8" strokeLinecap="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div style={{ paddingTop: 16 }}>
            <Mono>Add someone</Mono>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: SANS, fontSize: 17, fontWeight: 600, color: C.ink, marginTop: 8, paddingBottom: 8, borderBottom: `2px solid ${C.hair}` }} />
            <input value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").slice(0, 15))} placeholder="WhatsApp number with country code"
              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: SANS, fontSize: 15, color: C.ink, marginTop: 14, paddingBottom: 8, borderBottom: `2px solid ${C.hair}` }} />
            <div className="flex" style={{ gap: 6, flexWrap: "wrap", marginTop: 14 }}>
              {RELATIONS.map((x) => (
                <button key={x} onClick={() => setRel(x)} className="press"
                  style={{ border: `1px solid ${rel === x ? "transparent" : C.hair}`, background: rel === x ? GRAD : "rgba(255,255,255,0.10)",
                    color: rel === x ? "#FFFFFF" : C.ink2, borderRadius: 999, padding: "8px 14px",
                    fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  {x}
                </button>
              ))}
            </div>
            <Btn style={{ marginTop: 16 }} onClick={add} disabled={!name.trim()}>Add to circle</Btn>
          </div>
        </Card>

        <Card style={{ marginTop: 10 }}>
          <Mono>Send on</Mono>
          <div style={{ marginTop: 10 }}>
            <Seg value={String(care.day ?? 0)} onChange={(v) => setCare({ day: +v })}
              options={[{ value: "0", label: "Sunday" }, { value: "1", label: "Monday" }, { value: "5", label: "Friday" }, { value: "6", label: "Saturday" }]} />
          </div>
          <div style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.55, marginTop: 12 }}>
            You'll be reminded on the day. Nothing sends by itself — you see the message before it goes.
          </div>
        </Card>

        <Card style={{ marginTop: 10 }}>
          <Mono>This week's message</Mono>
          <pre style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.75, color: C.ink2, whiteSpace: "pre-wrap", margin: "12px 0 0" }}>{text}</pre>
        </Card>

        <div className="flex" style={{ gap: 8, marginTop: 10, marginBottom: 30 }}>
          <Btn kind="quiet" onClick={async () => say((await copyText(text)) ? "Copied" : "Copy blocked here")}>Copy</Btn>
          <Btn onClick={sendAll} disabled={!care.circle.length}>Send now</Btn>
        </div>
      </div>
    </div>
  );
}

/* What the family member sees. Their copy of the app has no data of its
   own — they paste in the update that arrived and keep the history. */
function Viewer({ data, setData }) {
  const care = data.care || { role: "viewer", circle: [], received: [] };
  const [paste, setPaste] = useState("");
  const received = care.received || [];

  const save = () => {
    if (!paste.trim()) return;
    setData((d) => ({ ...d, care: { ...care, received: [{ id: uid(), ts: Date.now(), text: paste.trim() }, ...received] } }));
    setPaste("");
  };

  const nudge = () => {
    const who = care.circle[0];
    const msg = "Hi, just checking in — could you take a BP reading and send this week's update from the app?";
    openLink(`https://wa.me/${(who?.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`);
  };

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      <Head title="Updates" icon={G.records(C.brand)} tint={C.brand} caption={received.length ? `Last received ${fmtDay(received[0].ts).toLowerCase()}` : "Nothing received yet"} />

      {received[0] && (
        <div className="rise" style={{ background: C.panel, color: C.onPanel, borderRadius: 22, padding: 20, marginTop: 16 }}>
          <Mono style={{ color: C.onPanel2 }}>Latest</Mono>
          <pre style={{ fontFamily: MONO, fontSize: 11.5, lineHeight: 1.8, color: C.onPanel, whiteSpace: "pre-wrap", margin: "12px 0 0" }}>
            {received[0].text}
          </pre>
        </div>
      )}

      <Card style={{ marginTop: 10 }}>
        <Mono>Paste an update</Mono>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4}
          placeholder="Paste the WhatsApp message here to keep it"
          style={{ width: "100%", marginTop: 10, border: `1px solid ${C.hair}`, borderRadius: 14, padding: 13,
            fontFamily: SANS, fontSize: 14, color: C.ink, background: "rgba(255,255,255,0.10)", outline: "none", resize: "vertical" }} />
        <div className="flex" style={{ gap: 8, marginTop: 10 }}>
          <Btn kind="quiet" onClick={nudge}>Nudge them</Btn>
          <Btn onClick={save} disabled={!paste.trim()}>Keep it</Btn>
        </div>
      </Card>

      {received.length > 1 && (
        <>
          <div style={{ padding: "24px 4px 10px" }}><Mono>Earlier</Mono></div>
          {received.slice(1).map((r) => (
            <Card key={r.id} style={{ marginBottom: 8 }}>
              <Mono>{fmtDay(r.ts)} · {fmtTime(r.ts)}</Mono>
              <pre style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1.7, color: C.ink2, whiteSpace: "pre-wrap", margin: "10px 0 0" }}>{r.text}</pre>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

/* ══════════════════ LAYER 1 · HEALTH SUMMARY ══════════════════════
   What is important about my health today. A snapshot, never an
   archive. Larger type and bigger targets than the tracking screens:
   this is the layer a 70-year-old opens first.
═══════════════════════════════════════════════════════════════════ */

const BLOOD_GROUPS = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"];

const activeMeds = (data) => data.meds.filter((m) => (m.status || "active") === "active");

function Health({ data, setData, go }) {
  const [edit, setEdit] = useState(false);
  const [cond, setCond] = useState("");
  const h = data.health || { conditions: [], allergies: "", bloodGroup: "", upcoming: [] };
  const setH = (patch) => setData((d) => ({ ...d, health: { ...h, ...patch } }));
  const recent = [...(data.history || [])].sort((a, b) => b.date - a.date).slice(0, 3);
  const refills = refillsDue(data);

  const Big = ({ children, style }) => (
    <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.35, ...style }}>{children}</div>
  );

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      <Head title="Health Summary" caption="your important health information at a glance" icon={G.health(C.mint)} tint={C.mint} />

      {/* conditions */}
      <Card style={{ padding: 20 }}>
        <Mono style={{ fontSize: 11 }}>Important conditions</Mono>
        {h.conditions.length === 0 && !edit && (
          <Big style={{ color: C.ink3, marginTop: 10 }}>None recorded</Big>
        )}
        <div style={{ marginTop: 10 }}>
          {h.conditions.map((c, i) => (
            <div key={i} className="flex items-center justify-between"
              style={{ padding: "12px 0", borderBottom: i < h.conditions.length - 1 ? `1px solid ${C.hair}` : "none" }}>
              <Big>{c}</Big>
              {edit && (
                <button onClick={() => setH({ conditions: h.conditions.filter((_, j) => j !== i) })} className="press"
                  style={{ border: "none", background: "transparent", cursor: "pointer", padding: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>
        {edit && (
          <div className="flex" style={{ gap: 8, marginTop: 14 }}>
            <input value={cond} onChange={(e) => setCond(e.target.value)} placeholder="Add a condition"
              onKeyDown={(e) => { if (e.key === "Enter" && cond.trim()) { setH({ conditions: [...h.conditions, cond.trim()] }); setCond(""); } }}
              style={{ flex: 1, border: `1px solid ${C.hair}`, borderRadius: 14, padding: "14px 15px", fontFamily: SANS, fontSize: 16, color: C.ink, background: "rgba(255,255,255,0.10)", outline: "none" }} />
            <button onClick={() => { if (cond.trim()) { setH({ conditions: [...h.conditions, cond.trim()] }); setCond(""); } }} className="press"
              style={{ background: C.panel, color: C.onPanel, border: "none", borderRadius: 14, padding: "14px 20px", fontFamily: SANS, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Add</button>
          </div>
        )}
      </Card>

      {/* allergies + blood group */}
      <div className="flex" style={{ gap: 10, marginTop: 10 }}>
        <Card style={{ flex: 1, padding: 20 }}>
          <Mono style={{ fontSize: 11 }}>Allergies</Mono>
          {edit ? (
            <input value={h.allergies} onChange={(e) => setH({ allergies: e.target.value })} placeholder="None known"
              style={{ width: "100%", border: "none", borderBottom: `2px solid ${C.hair}`, outline: "none", background: "transparent",
                fontFamily: SANS, fontSize: 18, fontWeight: 600, color: C.ink, marginTop: 10, paddingBottom: 6 }} />
          ) : (
            <Big style={{ marginTop: 10, color: h.allergies ? C.stage1 : C.ink }}>{h.allergies || "No known allergies"}</Big>
          )}
        </Card>
        <Card style={{ width: 132, padding: 20 }}>
          <Mono style={{ fontSize: 11 }}>Blood group</Mono>
          {edit ? (
            <select value={h.bloodGroup} onChange={(e) => setH({ bloodGroup: e.target.value })}
              style={{ width: "100%", marginTop: 10, border: `1px solid ${C.hair}`, borderRadius: 10, padding: "10px 8px",
                fontFamily: SANS, fontSize: 16, fontWeight: 700, color: C.ink, background: "rgba(255,255,255,0.10)" }}>
              <option value="">—</option>
              {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          ) : (
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.04em", marginTop: 8 }}>{h.bloodGroup || "—"}</div>
          )}
        </Card>
      </div>

      <Btn kind={edit ? "solid" : "quiet"} style={{ marginTop: 10, padding: "17px 18px", fontSize: 16 }} onClick={() => setEdit(!edit)}>
        {edit ? "Done editing" : "Edit health information"}
      </Btn>

      {/* current medications — active only */}
      <Card style={{ marginTop: 10, padding: 20 }} onClick={() => go("meds")}>
        <div className="flex items-center justify-between">
          <Mono style={{ fontSize: 11 }}>Current medications</Mono>
          <Mono style={{ fontSize: 11 }}>{activeMeds(data).length} active</Mono>
        </div>
        {activeMeds(data).length === 0 ? (
          <Big style={{ color: C.ink3, marginTop: 10 }}>None added</Big>
        ) : (
          activeMeds(data).map((m, i) => (
            <div key={m.id} style={{ padding: "12px 0", borderBottom: i < activeMeds(data).length - 1 ? `1px solid ${C.hair}` : "none" }}>
              <Big>{m.name}</Big>
              <div style={{ fontSize: 15, color: C.ink2, marginTop: 3 }}>
                {m.dose ? `${m.dose} · ` : ""}{m.slots.map((k) => slotOf(k).label.toLowerCase()).join(", ")}
              </div>
            </div>
          ))
        )}
        <div style={{ fontSize: 15, fontWeight: 600, color: C.brand, marginTop: 14 }}>View current medications →</div>
      </Card>

      {/* recent activity */}
      <Card style={{ marginTop: 10, padding: 20 }}>
        <Mono style={{ fontSize: 11 }}>Recent health activity</Mono>
        {recent.length === 0 ? (
          <Big style={{ color: C.ink3, marginTop: 10 }}>Nothing recorded yet</Big>
        ) : (
          recent.map((r, i) => (
            <div key={r.id} style={{ padding: "12px 0", borderBottom: i < recent.length - 1 ? `1px solid ${C.hair}` : "none" }}>
              <Mono style={{ fontSize: 11 }}>{new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</Mono>
              <Big style={{ marginTop: 3 }}>{r.title}</Big>
              <div style={{ fontSize: 14, color: C.ink3, marginTop: 2 }}>{typeOf(r.type).label}</div>
            </div>
          ))
        )}
        <Btn kind="quiet" style={{ marginTop: 16, padding: "16px", fontSize: 16 }} onClick={() => go("history")}>View medical history</Btn>
      </Card>

      {/* upcoming */}
      <Card style={{ marginTop: 10, padding: 20 }}>
        <Mono style={{ fontSize: 11 }}>Upcoming</Mono>
        {refills.length === 0 && !(h.upcoming || []).length ? (
          <Big style={{ color: C.ink3, marginTop: 10 }}>Nothing coming up</Big>
        ) : (
          <>
            {refills.map((r) => (
              <div key={r.med.id} style={{ padding: "12px 0", borderBottom: `1px solid ${C.hair}` }}>
                <Big>Medication refill · {r.med.name}</Big>
                <div style={{ fontSize: 15, fontWeight: 600, color: refillColor(r.days), marginTop: 3 }}>{refillLabel(r.days)}</div>
              </div>
            ))}
            {(h.upcoming || []).map((u, i) => (
              <div key={i} style={{ padding: "12px 0" }}>
                <Big>{u.title}</Big>
                <div style={{ fontSize: 15, color: C.ink2, marginTop: 3 }}>{u.when}</div>
              </div>
            ))}
          </>
        )}
      </Card>

      <Btn style={{ marginTop: 10, padding: "18px", fontSize: 16 }} onClick={() => go("me")}>Create summary PDF · share with doctor</Btn>
    </div>
  );
}

/* ══════════════════ LAYER 3 · MEDICAL HISTORY ═════════════════════
   A chronological archive. Nothing here is ever treated as current
   treatment — a prescription recorded in the past becomes an active
   medicine only when the user says so, on the record detail screen.
═══════════════════════════════════════════════════════════════════ */

/* Five kinds, not eight. A report is what a test produces, a hospital
   stay is where a procedure happens, and a visit is where a treatment
   is decided — so those folded in rather than standing alone. */
const HISTORY_TYPES = [
  { key: "test",      label: "Test or scan",       blurb: "Blood test, X-ray, MRI, or any report", color: C.low },
  { key: "diagnosis", label: "Diagnosis",          blurb: "A condition your doctor found",          color: C.stage2 },
  { key: "treatment", label: "Treatment or medicine", blurb: "A prescription, therapy or doctor visit", color: C.brand },
  { key: "procedure", label: "Procedure or surgery",  blurb: "An operation, or a stay in hospital",  color: C.elevated },
  { key: "other",     label: "Something else",     blurb: "Any other note worth keeping",           color: C.ink2 },
];

/* Records saved under the old eight-way split still open correctly. */
const LEGACY_TYPE = { report: "test", hospital: "procedure", visit: "treatment", note: "other" };
const normType = (k) => LEGACY_TYPE[k] || k;
const typeOf = (k) => HISTORY_TYPES.find((t) => t.key === normType(k)) || HISTORY_TYPES[4];

const TypeIcon = ({ k, color }) => {
  const s = { fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const g = {
    test:      <g><path {...s} d="M10 3.5v6L5.6 17a2 2 0 0 0 1.7 3h9.4a2 2 0 0 0 1.7-3L14 9.5v-6" /><path {...s} d="M9 3.5h6M8.3 14h7.4" /></g>,
    diagnosis: <g><rect {...s} x="5" y="4.5" width="14" height="16" rx="2.5" /><path {...s} d="M9 4.5h6v2.5H9zM8.5 12.5h2l1.2-2 1.6 3.5 1-1.5h2.2" /></g>,
    treatment: <g><rect {...s} x="2.8" y="8.6" width="18.4" height="6.8" rx="3.4" transform="rotate(-45 12 12)" /><path {...s} d="M9.6 9.6l4.8 4.8" /></g>,
    procedure: <g><path {...s} d="M19.5 4.5l-9 9M13.5 10.5l-6.8 6.8a2.4 2.4 0 1 1-2.4-2.4l6.8-6.8" /><path {...s} d="M16 8l3.5-3.5" /></g>,
    other:     <g><path {...s} d="M6 4.5h8.5L19 9v10.5H6z" /><path {...s} d="M14 4.5V9h5M9 13h6M9 16.5h4" /></g>,
  };
  return <svg width="24" height="24" viewBox="0 0 24 24">{g[normType(k)] || g.other}</svg>;
};

const FILTERS = [
  { key: "all", label: "All" }, { key: "test", label: "Tests" }, { key: "diagnosis", label: "Diagnoses" },
  { key: "treatment", label: "Treatments" }, { key: "procedure", label: "Procedures" }, { key: "other", label: "Other" },
];

const monthLabel = (ts) => new Date(ts).toLocaleDateString(undefined, { month: "long", year: "numeric" });

function History({ data, setData, go }) {
  const [dialog, ask] = useAsk();
  const [view, setView] = useState("list");     // list | pick | form | detail
  const [type, setType] = useState("test");
  const [openId, setOpenId] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState(null);
  const [toast, setToast] = useState("");

  const items = data.history || [];
  const say = (m) => { setToast(m); setTimeout(() => setToast(""), 2800); };

  const shown = items
    .filter((r) => filter === "all" || normType(r.type) === filter)
    .filter((r) => {
      if (!q.trim()) return true;
      const hay = `${r.title} ${r.details} ${r.doctor} ${r.hospital} ${r.medName} ${r.notes}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    })
    .sort((a, b) => b.date - a.date);

  const groups = [];
  shown.forEach((r) => {
    const key = monthLabel(r.date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(r);
    else groups.push({ key, items: [r] });
  });

  const blank = (t) => ({
    id: uid(), type: t, date: Date.now(), title: "", details: "", doctor: "", hospital: "",
    medName: "", medDose: "", notes: "", file: "", createdAt: Date.now(),
  });

  const save = () => {
    if (!draft.title.trim()) return;
    const exists = items.some((r) => r.id === draft.id);
    setData((d) => ({
      ...d,
      history: exists ? d.history.map((r) => (r.id === draft.id ? draft : r)) : [...(d.history || []), draft],
    }));
    if (draft.medName.trim()) { setOpenId(draft.id); setView("detail"); say("Saved. Medicine recorded as historical information."); }
    else { setView("list"); say("Saved to medical history"); }
  };

  const remove = async (id) => {
    const rec = items.find((r) => r.id === id);
    const ok = await ask({
      title: "Delete this record?",
      body: `${rec?.title || "This record"} will be removed from your medical history. This cannot be undone.`,
      confirmLabel: "Delete", danger: true, cancelLabel: "Keep it",
    });
    if (!ok) return;
    setData((d) => ({ ...d, history: d.history.filter((r) => r.id !== id) }));
    setView("list"); say("Record deleted");
  };

  /* ── the rule this whole layer exists to protect ── */
  const promote = async (rec) => {
    const ok = await ask({
      title: `Are you currently taking ${rec.medName}?`,
      body: "Only say yes if this is a medicine you take today. Otherwise it stays in your medical history as a past prescription.",
      confirmLabel: "Yes, add it", cancelLabel: "No, keep as history",
    });
    if (!ok) return;
    setData((d) => ({
      ...d,
      meds: [...d.meds, {
        id: uid(), name: rec.medName, dose: rec.medDose, slots: ["breakfast"],
        added: Date.now(), perDose: 1, stock: null, stockedAt: null, status: "active", fromHistory: rec.id,
      }],
      history: d.history.map((r) => (r.id === rec.id ? { ...r, promoted: true } : r)),
    }));
    say("Added to current medications. Set its timing on the Meds screen.");
  };

  const field = (labelText, key, { multi = false, placeholder = "" } = {}) => (
    <div style={{ marginTop: 18 }}>
      <Mono style={{ fontSize: 11 }}>{labelText}</Mono>
      {multi ? (
        <textarea rows={3} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} placeholder={placeholder}
          style={{ width: "100%", marginTop: 8, border: `1px solid ${C.hair}`, borderRadius: 14, padding: 14,
            fontFamily: SANS, fontSize: 16, color: C.ink, background: "rgba(255,255,255,0.10)", outline: "none", resize: "vertical", lineHeight: 1.5 }} />
      ) : (
        <input value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} placeholder={placeholder}
          style={{ width: "100%", marginTop: 8, border: `1px solid ${C.hair}`, borderRadius: 14, padding: "15px 14px",
            fontFamily: SANS, fontSize: 16, color: C.ink, background: "rgba(255,255,255,0.10)", outline: "none" }} />
      )}
    </div>
  );

  /* ── pick a record type ── */
  if (view === "pick") {
    return (
      <div style={{ padding: "20px 16px 120px" }}>
        {dialog}
        <Head title="Add a record" caption="what would you like to add?" right={
          <button onClick={() => setView("list")} className="press" style={{ border: `1px solid ${C.hair}`, background: C.card, borderRadius: 999, width: 40, height: 40, cursor: "pointer" }}>✕</button>
        } />
        {HISTORY_TYPES.map((t) => (
          <button key={t.key} onClick={() => { setType(t.key); setDraft(blank(t.key)); setView("form"); }} className="press"
            style={{ display: "flex", alignItems: "center", gap: 15, width: "100%", textAlign: "left", background: C.card,
              border: `1px solid ${C.hair}`, borderRadius: 18, padding: 18, marginBottom: 10, cursor: "pointer" }}>
            <span style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0, display: "grid", placeItems: "center",
              background: `linear-gradient(140deg, ${t.color}59 0%, ${t.color}1F 100%)`,
              border: `1px solid ${t.color}55`, boxShadow: `0 6px 16px ${t.color}22` }}>
              <TypeIcon k={t.key} color={t.color} />
            </span>
            <span>
              <span style={{ display: "block", fontFamily: SANS, fontSize: 18, fontWeight: 600, color: C.ink, letterSpacing: "-0.02em" }}>{t.label}</span>
              <span style={{ display: "block", fontFamily: SANS, fontSize: 14.5, color: C.ink2, marginTop: 3 }}>{t.blurb}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  /* ── the form ── */
  if (view === "form" && draft) {
    const t = typeOf(draft.type);
    const k = normType(draft.type);
    const titleFor = { test: "Test or scan name", diagnosis: "Diagnosis",
      treatment: "Treatment or medicine", procedure: "Procedure, surgery or hospital", other: "What is it about?" }[k];
    const detailFor = { test: "What did the report show?", diagnosis: "What did the doctor say?",
      treatment: "Why was it given?", procedure: "What was done, and what was found?", other: "Details" }[k];
    return (
      <div style={{ padding: "20px 16px 120px" }}>
        {dialog}
        <Head title={t.label} caption="fill in what you know · you can edit later" right={
          <button onClick={() => setView("list")} className="press" style={{ border: `1px solid ${C.hair}`, background: C.card, borderRadius: 999, width: 40, height: 40, cursor: "pointer" }}>✕</button>
        } />
        <Card style={{ padding: 20 }}>
          <Mono style={{ fontSize: 11 }}>Date</Mono>
          <input type="date" value={new Date(draft.date).toISOString().slice(0, 10)}
            onChange={(e) => setDraft({ ...draft, date: new Date(e.target.value).getTime() || Date.now() })}
            style={{ width: "100%", marginTop: 8, border: `1px solid ${C.hair}`, borderRadius: 14, padding: "14px",
              fontFamily: SANS, fontSize: 16, color: C.ink, background: "rgba(255,255,255,0.10)" }} />
          {field(titleFor, "title", { placeholder: "Required" })}
          {field(detailFor, "details", { multi: true })}
          {field("Doctor", "doctor")}
          {field(draft.type === "test" ? "Hospital or laboratory" : "Hospital or clinic", "hospital")}
          {["treatment", "diagnosis", "procedure", "other"].includes(k) && (
            <>
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.hair}` }}>
                <Mono style={{ fontSize: 11 }}>Medicine prescribed then — optional</Mono>
                <div style={{ fontSize: 14, color: C.ink2, marginTop: 6, lineHeight: 1.5 }}>
                  This is recorded as history. It does not become a medicine you are taking now.
                </div>
              </div>
              {field("Medicine name", "medName")}
              {field("Dose", "medDose", { placeholder: "1 tablet" })}
            </>
          )}
          {field("Notes", "notes", { multi: true })}
          <div style={{ marginTop: 18 }}>
            <Mono style={{ fontSize: 11 }}>Report</Mono>
            <label className="press" style={{ display: "block", marginTop: 8, border: `1px dashed ${C.hair}`, borderRadius: 14,
              padding: 18, textAlign: "center", cursor: "pointer", background: C.card }}>
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setDraft({ ...draft, file: `${f.name} · ${(f.size / 1024 / 1024).toFixed(1)} MB` }); }} />
              <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, color: C.ink }}>
                {draft.file || "Take a photo or choose a file"}
              </span>
            </label>
            {draft.file && <div style={{ fontSize: 13, color: C.ink3, marginTop: 8, lineHeight: 1.5 }}>The file name is saved on this phone. The file itself stays where it is.</div>}
          </div>
          <Btn style={{ marginTop: 22, padding: "18px", fontSize: 16 }} disabled={!draft.title.trim()} onClick={save}>Save to medical history</Btn>
        </Card>
      </div>
    );
  }

  /* ── one record ── */
  if (view === "detail") {
    const r = items.find((x) => x.id === openId);
    if (!r) { setView("list"); return null; }
    const t = typeOf(r.type);
    const Line = ({ k, v }) => v ? (
      <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.hair}` }}>
        <Mono style={{ fontSize: 11 }}>{k}</Mono>
        <div style={{ fontSize: 16.5, color: C.ink, marginTop: 5, lineHeight: 1.5 }}>{v}</div>
      </div>
    ) : null;
    return (
      <div style={{ padding: "20px 16px 120px" }}>
        {dialog}
        <Head title="Record" caption={new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} right={
          <button onClick={() => setView("list")} className="press" style={{ border: `1px solid ${C.hair}`, background: C.card, borderRadius: 999, width: 40, height: 40, cursor: "pointer" }}>✕</button>
        } />
        <Card style={{ padding: 20 }}>
          <div className="flex items-center" style={{ gap: 11 }}>
            <span style={{ width: 40, height: 40, borderRadius: 13, display: "grid", placeItems: "center",
              background: `linear-gradient(140deg, ${t.color}59 0%, ${t.color}1F 100%)`, border: `1px solid ${t.color}55` }}>
              <TypeIcon k={r.type} color={t.color} />
            </span>
            <Mono style={{ fontSize: 11 }}>{t.label}</Mono>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 10, lineHeight: 1.25 }}>{r.title}</div>
          <div style={{ marginTop: 14 }}>
            <Line k="What it showed" v={r.details} />
            <Line k="Doctor" v={r.doctor} />
            <Line k="Hospital" v={r.hospital} />
            <Line k="Report" v={r.file} />
            <Line k="Notes" v={r.notes} />
          </div>
        </Card>

        {r.medName && (
          <Card style={{ marginTop: 10, padding: 20, borderColor: C.elevated }}>
            <div className="flex items-center" style={{ gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: C.elevated }} />
              <Mono style={{ fontSize: 11, color: C.elevated }}>Historical medicine</Mono>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 10 }}>{r.medName}</div>
            {r.medDose && <div style={{ fontSize: 16, color: C.ink2, marginTop: 4 }}>{r.medDose}</div>}
            <div style={{ fontSize: 14.5, color: C.ink2, marginTop: 12, lineHeight: 1.55 }}>
              This was prescribed as part of this past event. It is not one of your current medicines.
            </div>
            {r.promoted ? (
              <div style={{ fontSize: 15, fontWeight: 600, color: C.brand, marginTop: 14 }}>✓ Already in current medications</div>
            ) : (
              <Btn style={{ marginTop: 16, padding: "17px", fontSize: 16 }} onClick={() => promote(r)}>Add to current medications</Btn>
            )}
          </Card>
        )}

        <div className="flex" style={{ gap: 8, marginTop: 10 }}>
          <Btn kind="quiet" style={{ padding: "16px", fontSize: 15 }} onClick={() => { setDraft(r); setView("form"); }}>Edit</Btn>
          <Btn kind="quiet" style={{ padding: "16px", fontSize: 15 }}
            onClick={() => openLink(`https://wa.me/?text=${encodeURIComponent(`${r.title}\n${new Date(r.date).toLocaleDateString()}\n${typeOf(r.type).label}\n\n${r.details || ""}`)}`)}>Share</Btn>
          <Btn kind="quiet" style={{ padding: "16px", fontSize: 15, color: C.stage2 }} onClick={() => remove(r.id)}>Delete</Btn>
        </div>
      </div>
    );
  }

  /* ── the timeline ── */
  return (
    <div style={{ padding: "20px 16px 120px" }}>
      {dialog}
      <Head title="Medical History" caption="your medical journey, organised by date" icon={G.records(C.elevated)} tint={C.elevated} />
      {toast && <div style={{ background: C.panelSoft, color: C.onPanel2, borderRadius: 14, padding: "14px 16px", fontSize: 14.5, marginBottom: 12, lineHeight: 1.5 }}>{toast}</div>}

      <Btn style={{ padding: "18px", fontSize: 16 }} onClick={() => setView("pick")}>+ Add medical record</Btn>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your history"
        style={{ width: "100%", marginTop: 12, border: `1px solid ${C.hair}`, borderRadius: 15, padding: "15px 16px",
          fontFamily: SANS, fontSize: 16, color: C.ink, background: "rgba(255,255,255,0.10)", outline: "none" }} />

      <div className="flex" style={{ gap: 7, marginTop: 12, overflowX: "auto", paddingBottom: 4 }}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className="press"
            style={{ flexShrink: 0, border: `1px solid ${filter === f.key ? "transparent" : C.hair}`,
              background: filter === f.key ? GRAD : "rgba(255,255,255,0.10)", color: filter === f.key ? "#FFFFFF" : C.ink2,
              borderRadius: 999, padding: "10px 16px", fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <Card style={{ marginTop: 14, padding: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{items.length ? "Nothing matches" : "Your history is empty"}</div>
          <div style={{ fontSize: 15, color: C.ink2, marginTop: 6, lineHeight: 1.5 }}>
            {items.length ? "Try another word or clear the filter." : "Add your past tests, diagnoses, procedures and hospital stays. They stay on this phone."}
          </div>
        </Card>
      )}

      {groups.map((g) => (
        <div key={g.key} style={{ marginTop: 22 }}>
          <Mono style={{ fontSize: 11, display: "block", padding: "0 4px 10px" }}>{g.key}</Mono>
          {g.items.map((r) => {
            const t = typeOf(r.type);
            const d = new Date(r.date);
            return (
              <button key={r.id} onClick={() => { setOpenId(r.id); setView("detail"); }} className="press"
                style={{ display: "flex", gap: 14, width: "100%", textAlign: "left", background: C.card,
                  border: `1px solid ${C.hair}`, borderRadius: 18, padding: 16, marginBottom: 8, cursor: "pointer" }}>
                <span style={{ flexShrink: 0, width: 52, height: 52, borderRadius: 15, display: "grid", placeItems: "center",
                  background: `linear-gradient(140deg, ${t.color}66 0%, ${t.color}22 100%)`,
                  border: `1px solid ${t.color}55`, boxShadow: `0 6px 16px ${t.color}22` }}>
                  <span style={{ display: "block", textAlign: "center" }}>
                    <span style={{ display: "block", fontFamily: SANS, fontSize: 19, fontWeight: 700, letterSpacing: "-0.03em", color: "#FFFFFF", lineHeight: 1.05 }}>{d.getDate()}</span>
                    <span style={{ display: "block", fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.1em", color: "rgba(255,255,255,0.8)", textTransform: "uppercase" }}>
                      {d.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                  </span>
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="flex items-center justify-between" style={{ gap: 8 }}>
                    <span style={{ fontFamily: SANS, fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", color: C.ink }}>{r.title}</span>
                    <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 10, background: `${t.color}2E`,
                      border: `1px solid ${t.color}4D`, display: "grid", placeItems: "center" }}>
                      <TypeIcon k={r.type} color={t.color} />
                    </span>
                  </span>
                  {r.details && (
                    <span style={{ display: "block", fontFamily: SANS, fontSize: 14.5, color: C.ink2, marginTop: 5, lineHeight: 1.45,
                      overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {r.details}
                    </span>
                  )}
                  {r.medName && (
                    <span style={{ display: "inline-block", marginTop: 8, fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em",
                      textTransform: "uppercase", color: r.promoted ? C.brand : C.elevated }}>
                      {r.promoted ? "· also a current medicine" : "· historical medicine"}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── shell ───────────────────────────── */

const VIEWER_TABS = [
  { key: "family", label: "Updates" },
  { key: "coach", label: "Coach" },
  { key: "learn", label: "Learn" },
  { key: "me", label: "Profile" },
];

/* Today · Health · [+] · Medicines · History.
   The three health layers each get a tab. Record, Coach, Learn and
   Profile are one tap away from Today, so nothing was lost. */
const TABS = [
  { key: "home", label: "Home" },
  { key: "log", label: "Readings" },
  { key: "history", label: "Records" },
  { key: "meds", label: "Medicines" },
  { key: "me", label: "Profile" },
];

const Ico = ({ name, on }) => {
  const s = { fill: "none", stroke: on ? "#FFFFFF" : C.ink3, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const g = {
    home: <g><circle {...s} cx="12" cy="12" r="8" /><path {...s} d="M12 12l4-3" /></g>,
    log: <g><path {...s} d="M4 17.5l4.5-5 3.2 3 4.3-6 4 4.4" /><path {...s} d="M4 20.5h16" /></g>,
    meds: <g><rect {...s} x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)" /><path {...s} d="M9.6 9.6l4.8 4.8" /></g>,
    health: <g><path {...s} d="M12 20s-7-4.4-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7C19 15.6 12 20 12 20z" /><path {...s} d="M8 12.5h2l1.2-2 1.6 3.2 1-1.2h2.2" /></g>,
    history: <g><path {...s} d="M6 3.8h8.2L18.5 8v12.2H6z" /><path {...s} d="M14 3.8V8h4.4M9 12h6M9 15.5h4" /></g>,
    coach: <g><path {...s} d="M4 6.5h16v9H10l-4.5 3.5v-3.5H4z" /></g>,
    learn: <g><path {...s} d="M4 5.5h6.5a1.5 1.5 0 0 1 1.5 1.5v11a1.2 1.2 0 0 0-1.2-1.2H4zM20 5.5h-6.5A1.5 1.5 0 0 0 12 7v11a1.2 1.2 0 0 1 1.2-1.2H20z" /></g>,
    family: <g><circle {...s} cx="9" cy="9" r="3" /><circle {...s} cx="16.5" cy="10.5" r="2.2" /><path {...s} d="M3.5 19c1-2.6 3-4 5.5-4s4.5 1.4 5.5 4M16 14.2c2 .2 3.5 1.5 4.3 3.4" /></g>,
    me: <g><circle {...s} cx="12" cy="8.6" r="3.3" /><path {...s} d="M5.5 19.5c1.3-3.2 3.8-4.8 6.5-4.8s5.2 1.6 6.5 4.8" /></g>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24">{g[name]}</svg>;
};

const EMPTY = {
  profile: { name: "", age: "", sex: "", heightCm: "", diet: "veg" },
  bp: [], body: [], sugar: [], chat: [],
  meds: [], taken: {},
  health: { conditions: [], allergies: "", bloodGroup: "", upcoming: [] },
  history: [],
  care: { role: "logger", circle: [], received: [], day: 0 },
  medSettings: { times: Object.fromEntries(SLOTS.map((s) => [s.key, s.time])), lead: 10, notify: false },
};

/* Follows you across tabs. A dose that's due outranks a refill warning. */
function DoseBanner({ data, setData, go }) {
  const { doses, refills } = useReminders(data);
  const [hidden, setHidden] = useState([]);
  const d = doses[0];
  const refill = refills.find((r) => !hidden.includes(r.med.id));

  if (!d && !refill) return null;

  const take = () => {
    const day = dayKey();
    setData((prev) => ({
      ...prev,
      taken: { ...(prev.taken || {}), [day]: { ...(prev.taken?.[day] || {}), [d.id]: Date.now() } },
    }));
  };

  const shell = {
    position: "fixed", bottom: 78, left: 12, right: 12, maxWidth: 406, margin: "0 auto", zIndex: 45,
    background: "linear-gradient(135deg, rgba(167,139,250,0.96) 0%, rgba(236,127,208,0.94) 100%)", color: "#FFFFFF", borderRadius: 20, padding: "14px 15px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
  };
  const btn = {
    background: "rgba(255,255,255,0.96)", color: "#5B21B6", border: "none", borderRadius: 13, padding: "11px 16px",
    fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: "pointer", flexShrink: 0,
  };

  if (d) {
    return (
      <div className="rise" style={shell}>
        <div onClick={() => go("meds")} style={{ minWidth: 0, cursor: "pointer" }}>
          <Mono style={{ color: C.onPanel2 }}>
            {slotOf(d.slot).label} · {prettyTime(d.time)}{doses.length > 1 ? ` · +${doses.length - 1} more` : ""}
          </Mono>
          <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {d.med.name}{d.med.dose ? ` · ${d.med.dose}` : ""}
          </div>
        </div>
        <button onClick={take} className="press" style={btn}>Taken</button>
      </div>
    );
  }

  return (
    <div className="rise" style={shell}>
      <div onClick={() => go("meds")} style={{ minWidth: 0, cursor: "pointer" }}>
        <Mono style={{ color: refillColor(refill.days) }}>
          Refill · {refillLabel(refill.days).toLowerCase()}
          {refills.length > 1 ? ` · +${refills.length - 1} more` : ""}
        </Mono>
        <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {refill.med.name}
        </div>
      </div>
      <button onClick={() => setHidden((h) => [...h, refill.med.id])} className="press" style={btn}>Got it</button>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [data, setData] = useState(EMPTY);
  const isViewer = data.care?.role === "viewer";
  const navTabs = isViewer ? VIEWER_TABS : TABS;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("aneroid:v1");
        if (r?.value) setData({ ...EMPTY, ...JSON.parse(r.value) });
      } catch {}
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!navTabs.some((t) => t.key === tab)) setTab(navTabs[0].key);
  }, [isViewer]);

  useEffect(() => {
    if (!ready) return;
    (async () => { try { await window.storage.set("aneroid:v1", JSON.stringify(data)); } catch {} })();
  }, [data, ready]);

  return (
    <div style={{ background: C.paper, minHeight: "100vh", fontFamily: SANS, color: C.ink, WebkitFontSmoothing: "antialiased", position: "relative", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        .press { transition: transform 120ms ease, opacity 120ms ease; }
        .press:active { transform: scale(0.97); }
        .rise { animation: rise 460ms cubic-bezier(.16,1,.3,1) both; }
        @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .dot { animation: blink 1s infinite ease-in-out; }
        @keyframes blink { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
        ::placeholder { color: ${C.ink3}; font-weight: 400; }
        ::selection { background: rgba(236,127,208,0.35); }
        input, textarea, select { color-scheme: dark; }
        select option { background: ${C.cardSolid}; color: ${C.ink}; }
        button:focus-visible, input:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 3px; }
        ::-webkit-scrollbar { width: 0; }
        @media (prefers-reduced-motion: reduce) { *, .rise, .dot { animation: none !important; transition: none !important; } }
      `}</style>

      {/* ambient light — two soft blooms behind the glass */}
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(760px 520px at 12% -8%, rgba(139,92,246,0.75), transparent 62%), radial-gradient(620px 480px at 104% 8%, rgba(236,72,153,0.42), transparent 60%), radial-gradient(680px 520px at 92% 88%, rgba(56,189,248,0.32), transparent 62%), radial-gradient(560px 460px at -10% 96%, rgba(167,139,250,0.40), transparent 60%), linear-gradient(170deg, #3B1E8F 0%, #2B1B63 46%, #1E1B4B 100%)" }} />

      <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", position: "relative", zIndex: 1 }}>
        {ready && tab !== "coach" && (
          <div className="flex items-center justify-between" style={{ position: "sticky", top: 0, zIndex: 40,
            padding: "13px 18px", background: "rgba(43,27,99,0.55)", backdropFilter: "blur(26px) saturate(150%)",
            WebkitBackdropFilter: "blur(26px) saturate(150%)", borderBottom: `1px solid ${C.hair}` }}>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em",
              background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{APP_NAME}</span>
            <button onClick={() => setTab("meds")} className="press" aria-label="reminders"
              style={{ position: "relative", width: 38, height: 38, borderRadius: 999, cursor: "pointer",
                background: "rgba(255,255,255,0.14)", border: `1px solid ${C.hair}`, display: "grid", placeItems: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9z" /><path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
              </svg>
              {dosesToday(data).some((d) => !isTaken(data, d.id)) && (
                <span style={{ position: "absolute", top: 6, right: 7, width: 8, height: 8, borderRadius: 999,
                  background: C.stage2, border: `1.5px solid ${C.paper}` }} />
              )}
            </button>
          </div>
        )}
        {!ready ? (
          <div style={{ padding: 40 }}><Mono>Opening your record…</Mono></div>
        ) : tab === "family" ? <Viewer data={data} setData={setData} />
          : tab === "health" ? <Health data={data} setData={setData} go={setTab} />
          : tab === "history" ? <History data={data} setData={setData} go={setTab} />
          : tab === "home" ? <Home data={data} go={setTab} />
          : tab === "log" ? <Log data={data} setData={setData} />
          : tab === "meds" ? <Meds data={data} setData={setData} />
          : tab === "coach" ? <Coach data={data} setData={setData} />
          : tab === "learn" ? <Learn />
          : <Profile data={data} setData={setData} go={setTab} />}

        {ready && !isViewer && tab !== "meds" && <DoseBanner data={data} setData={setData} go={setTab} />}

        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 430, margin: "0 auto",
          background: "rgba(43,27,99,0.60)", backdropFilter: "blur(26px) saturate(150%)", WebkitBackdropFilter: "blur(26px) saturate(150%)",
          borderTop: `1px solid ${C.hair}`, display: "flex", padding: "8px 2px 13px", zIndex: 30,
        }}>
          {navTabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className="press"
              style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {(() => {
                const on = tab === t.key || (t.key === "home" && tab === "health");
                return (
                  <>
                    <span style={{ width: 44, height: 34, borderRadius: 13, display: "grid", placeItems: "center",
                      background: on ? GRAD : "transparent", transition: "background 180ms ease",
                      boxShadow: on ? "0 6px 16px rgba(167,139,250,0.42)" : "none" }}>
                      <Ico name={t.key} on={on} />
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.06em", textTransform: "uppercase",
                      color: on ? "#FFFFFF" : C.ink3 }}>
                      {t.label}
                    </span>
                  </>
                );
              })()}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}