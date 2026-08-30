import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { C } from '../../theme/colors';
import { SANS } from '../../theme/typography';
import { clamp } from '../../lib/calc';
import Mono from './Mono';

/* Stepper — hold the +/- keys to run, or tap the number and type it.
   decimals: 0 for whole units (mmHg, cm), 1 for weight. */
export default function Stepper({ label, unit, value, set, step = 1, min, max, decimals = 0 }) {
  const hold = useRef(null);
  const inputRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const round = n => +clamp(n, min, max).toFixed(decimals);
  const shown = value === '' || value == null || isNaN(+value) ? '––' : decimals ? Number(value).toFixed(decimals) : String(value);

  useEffect(() => {
    if (editing) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [editing]);

  const bump = d => set(round((+value || min) + d));
  const start = d => {
    stop();
    bump(d);
    hold.current = setTimeout(function rep() {
      bump(d);
      hold.current = setTimeout(rep, 70);
    }, 430);
  };
  const stop = () => {
    clearTimeout(hold.current);
    hold.current = null;
  };
  useEffect(() => stop, []);

  const open = () => {
    setDraft(shown === '––' ? '' : shown);
    setEditing(true);
  };
  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n)) set(round(n));
    setEditing(false);
  };
  const clean = s => {
    let v = s.replace(decimals ? /[^\d.]/g : /\D/g, '');
    if (decimals) {
      const [a, ...rest] = v.split('.');
      v = rest.length ? `${a}.${rest.join('').slice(0, decimals)}` : a;
    }
    return v.slice(0, decimals ? 5 : 3);
  };

  const KeyBtn = ({ d, sym }) => (
    <Pressable
      onPressIn={() => start(d)}
      onPressOut={stop}
      hitSlop={6}
      style={({ pressed }) => [styles.keyBtn, pressed && styles.keyBtnPressed]}
      accessibilityLabel={d < 0 ? `decrease ${label}` : `increase ${label}`}>
      <Text style={styles.keySym}>{sym}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Mono style={styles.label}>{label}</Mono>
        <Mono style={styles.rangeHint}>{editing ? 'enter to set' : `${min}–${max}`}</Mono>
      </View>

      <View style={styles.valueRow}>
        <KeyBtn d={-step} sym="−" />

        <Pressable onPress={() => !editing && open()} style={[styles.numberWrap, editing && styles.numberWrapEditing]}>
          {editing ? (
            <TextInput
              ref={inputRef}
              value={draft}
              keyboardType="decimal-pad"
              onChangeText={t => setDraft(clean(t))}
              onBlur={commit}
              onSubmitEditing={commit}
              selectTextOnFocus
              style={styles.input}
            />
          ) : (
            <Text style={styles.number}>{shown}</Text>
          )}
          <Mono style={styles.unit}>{unit}</Mono>
        </Pressable>

        <KeyBtn d={step} sym="+" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.hair,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: C.ink2,
  },
  rangeHint: {
    fontSize: 13,
    color: C.ink2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  keyBtn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.hair,
    backgroundColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  keyBtnPressed: {
    opacity: 0.7,
  },
  keySym: {
    fontFamily: SANS.medium,
    fontSize: 22,
    lineHeight: 24,
    color: C.ink,
  },
  numberWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  numberWrapEditing: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  number: {
    fontFamily: SANS.bold,
    fontSize: 46,
    letterSpacing: -2,
    color: C.ink,
  },
  input: {
    fontFamily: SANS.bold,
    fontSize: 46,
    letterSpacing: -2,
    color: C.ink,
    padding: 0,
    minWidth: 40,
    textAlign: 'center',
  },
  unit: {
    fontSize: 13.5,
  },
});
