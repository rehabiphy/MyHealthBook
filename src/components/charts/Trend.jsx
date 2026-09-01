import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Polygon, Polyline, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { C } from '../../theme/colors';
import { MONO } from '../../theme/typography';
import Mono from '../atoms/Mono';

/* Trend with a scrubber — tap any point to read that entry. */
export default function Trend({ rows, onPick, picked }) {
  const w = 320,
    h = 130,
    padX = 10,
    padT = 14,
    padB = 22;

  if (rows.length < 2) {
    return (
      <View style={{ paddingVertical: 28, alignItems: 'center' }}>
        <Mono>Two readings draw the trend</Mono>
      </View>
    );
  }

  const sys = rows.map(r => r.sys),
    dia = rows.map(r => r.dia);
  const lo = Math.min(...dia, 70) - 10,
    hi = Math.max(...sys, 130) + 10;
  const X = i => padX + (i / (rows.length - 1)) * (w - padX * 2);
  const Y = v => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
  const line = arr => arr.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  const area = `${line(sys)} ${X(rows.length - 1)},${h - padB} ${X(0)},${h - padB}`;

  return (
    <Svg viewBox={`0 0 ${w} ${h}`} width="100%" height={150}>
      <Defs>
        <LinearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0%" stopColor={C.stage1} stopOpacity="0.32" />
          <Stop offset="100%" stopColor={C.stage1} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {[120, 80].map(v => (
        <G key={v}>
          <Line x1={padX} x2={w - padX} y1={Y(v)} y2={Y(v)} stroke={C.hair} strokeDasharray="2 5" />
          <SvgText x={w - padX} y={Y(v) - 4} textAnchor="end" fontFamily={MONO.regular} fontSize="8" fill={C.ink3}>
            {v}
          </SvgText>
        </G>
      ))}
      <Polygon points={area} fill="url(#g)" />
      <Polyline points={line(sys)} fill="none" stroke={C.stage1} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      <Polyline points={line(dia)} fill="none" stroke={C.brand} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {rows.map((r, i) => (
        <G key={r.id} onPress={() => onPick(i)}>
          <Rect x={X(i) - 12} y={0} width={24} height={h} fill="transparent" />
          {picked === i && <Line x1={X(i)} x2={X(i)} y1={padT - 6} y2={h - padB} stroke={C.ink3} strokeWidth={1} />}
          <Circle cx={X(i)} cy={Y(r.sys)} r={picked === i ? 4.5 : 2.6} fill={C.stage1} stroke={C.cardSolid} strokeWidth={picked === i ? 2 : 0} />
          <Circle cx={X(i)} cy={Y(r.dia)} r={picked === i ? 4.5 : 2.6} fill={C.brand} stroke={C.cardSolid} strokeWidth={picked === i ? 2 : 0} />
          <SvgText x={X(i)} y={h - 6} textAnchor="middle" fontFamily={MONO.regular} fontSize="8" fill={picked === i ? C.ink : C.ink3}>
            {new Date(r.ts).getDate()}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}
