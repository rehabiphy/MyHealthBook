import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { C } from '../../theme/colors';
import { clamp } from '../../lib/calc';

const AnimatedG = Animated.createAnimatedComponent(G);

/* ── SIGNATURE: the aneroid dial ──────────────────────────────────
   A 220° sweep with the pressure bands laid on the rim and a needle
   that settles on your systolic. One instrument, read at a glance. */

const A0 = 160,
  A1 = 380; // sweep in degrees (SVG coords, 0 = east)
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

export default function Dial({ value, min = 80, max = 180, bands, size = 210, dark = true, animate = true }) {
  const [live, setLive] = useState(animate ? min : value);
  const angleAnim = useRef(new Animated.Value(toAngle(animate ? min : value, min, max))).current;

  useEffect(() => {
    const t = setTimeout(() => setLive(value), 60);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const anim = Animated.timing(angleAnim, {
      toValue: toAngle(live ?? min, min, max),
      duration: 1100,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: false, // animating an SVG rotation prop, not a transform style
    });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const cx = size / 2,
    cy = size / 2,
    r = size / 2 - 16;
  const ticks = [];
  for (let v = min; v <= max; v += 10) ticks.push(v);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Path d={arc(cx, cy, r, A0, A1)} stroke="rgba(22,36,28,0.08)" strokeWidth={10} fill="none" strokeLinecap="round" />
      {bands.map((b, i) => (
        <Path
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
        return <Line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="rgba(22,36,28,0.20)" strokeWidth={1.2} />;
      })}
      <AnimatedG rotation={angleAnim} origin={`${cx}, ${cy}`}>
        <Line x1={cx} y1={cy} x2={cx + r - 20} y2={cy} stroke={dark ? C.onPanel : C.ink} strokeWidth={2.4} strokeLinecap="round" />
      </AnimatedG>
      <Circle cx={cx} cy={cy} r={5} fill={dark ? C.onPanel : C.ink} />
      <Circle cx={cx} cy={cy} r={11} fill="none" stroke="rgba(22,36,28,0.20)" strokeWidth={1} />
    </Svg>
  );
}
