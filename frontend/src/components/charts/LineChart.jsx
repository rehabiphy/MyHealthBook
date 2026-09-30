import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { C } from '../../theme/colors';
import { MONO, SANS } from '../../theme/typography';
import Mono from '../atoms/Mono';

/* Readings over time: one polyline per series, x by actual date (so a
   gap in logging shows as a gap), y fitted to the values. Tap anywhere
   to read the entries nearest that moment. */
export default function LineChart({ series, window, unit }) {
  const [pickedTs, setPickedTs] = useState(null);
  const viewWidth = useRef(0);
  const w = 320,
    h = 170,
    padL = 30,
    padR = 10,
    padT = 12,
    padB = 22;

  const all = series.flatMap(s => s.points);
  if (all.length < 2) {
    return (
      <View style={styles.empty}>
        <Mono>{all.length ? 'One entry in this period — two draw a line' : 'No entries in this period'}</Mono>
      </View>
    );
  }

  const vs = all.map(p => p.v);
  let lo = Math.min(...vs),
    hi = Math.max(...vs);
  const pad = Math.max((hi - lo) * 0.12, 2);
  lo = Math.floor(lo - pad);
  hi = Math.ceil(hi + pad);
  const span = Math.max(1, window.to - window.from);
  const X = ts => padL + ((ts - window.from) / span) * (w - padL - padR);
  const Y = v => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const showDots = all.length <= 90;

  // the tapped moment → nearest point of each series
  const picked =
    pickedTs == null
      ? null
      : series
          .map(s => {
            if (!s.points.length) return null;
            const p = s.points.reduce((best, q) => (Math.abs(q.ts - pickedTs) < Math.abs(best.ts - pickedTs) ? q : best));
            return { ...p, label: s.label, color: s.color };
          })
          .filter(Boolean);
  // locationX is in view pixels; the svg stretches its viewBox width `w` across the view
  const onTap = e => {
    const ratio = viewWidth.current ? w / viewWidth.current : 1;
    const ts = window.from + ((e.nativeEvent.locationX * ratio - padL) / (w - padL - padR)) * span;
    setPickedTs(Math.min(window.to, Math.max(window.from, ts)));
  };

  return (
    <View>
      <View onLayout={e => (viewWidth.current = e.nativeEvent.layout.width)} onStartShouldSetResponder={() => true} onResponderRelease={onTap}>
        <Svg viewBox={`0 0 ${w} ${h}`} width="100%" height={190}>
          {ticks.map(v => (
            <G key={v}>
              <Line x1={padL} x2={w - padR} y1={Y(v)} y2={Y(v)} stroke={C.hair} strokeDasharray="2 5" />
              <SvgText x={padL - 4} y={Y(v) + 3} textAnchor="end" fontFamily={MONO.regular} fontSize="8" fill={C.ink3}>
                {v}
              </SvgText>
            </G>
          ))}
          <SvgText x={padL} y={h - 6} fontFamily={MONO.regular} fontSize="8" fill={C.ink3}>
            {shortDate(window.from)}
          </SvgText>
          <SvgText x={w - padR} y={h - 6} textAnchor="end" fontFamily={MONO.regular} fontSize="8" fill={C.ink3}>
            {shortDate(window.to)}
          </SvgText>
          {series.map(s =>
            s.points.length ? (
              <G key={s.key}>
                {s.points.length > 1 && (
                  <Polyline points={s.points.map(p => `${X(p.ts)},${Y(p.v)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                )}
                {(showDots || s.points.length === 1) && s.points.map(p => <Circle key={p.ts} cx={X(p.ts)} cy={Y(p.v)} r={2.4} fill={s.color} />)}
              </G>
            ) : null,
          )}
          {picked?.length ? <Line x1={X(picked[0].ts)} x2={X(picked[0].ts)} y1={padT} y2={h - padB} stroke={C.ink3} strokeWidth={1} /> : null}
          {picked?.map(p => (
            <Circle key={p.label} cx={X(p.ts)} cy={Y(p.v)} r={4.5} fill={p.color} stroke={C.cardSolid} strokeWidth={2} />
          ))}
          <Rect x={0} y={0} width={w} height={h} fill="transparent" />
        </Svg>
      </View>

      <View style={styles.legend}>
        {series.map(s => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.label}</Text>
          </View>
        ))}
      </View>

      {picked?.length ? (
        <Text style={styles.readout}>
          {picked.map(p => `${p.label} ${p.v} ${unit}`).join(' · ')} — {new Date(picked[0].ts).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </Text>
      ) : (
        <Text style={styles.hint}>Tap the chart to read an entry</Text>
      )}
    </View>
  );
}

const shortDate = ts => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });

const styles = StyleSheet.create({
  empty: { paddingVertical: 40, alignItems: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontFamily: SANS.regular, fontSize: 13, color: C.ink2 },
  readout: { fontFamily: SANS.semibold, fontSize: 13.5, color: C.ink, marginTop: 8 },
  hint: { fontFamily: SANS.regular, fontSize: 12.5, color: C.ink3, marginTop: 8 },
});
