import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { C } from '../../theme/colors';
import { SANS } from '../../theme/typography';
import Press from './Press';

function EyeIcon({ open }) {
  return (
    <Svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={C.ink2} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <Circle cx="12" cy="12" r="3" />
      {!open && <Path d="M3 3l18 18" />}
    </Svg>
  );
}

/* Bordered, filled text field matching the look already established
   by AskDialogContext's inline TextInput — this is the same style
   promoted to a reusable atom, since Login/Register need several of
   these and no Input atom existed yet. */
/* `right` renders inside the field's right edge — a status icon or a
   small button. A `secureTextEntry` field gets a show/hide eye there on
   its own. */
export default function Input({ label, value, onChangeText, error, hint, right, secureTextEntry, keyboardType, autoCapitalize = 'sentences', autoCorrect, placeholder, editable = true }) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderColor = error ? C.stage2 : focused ? C.brand : C.hair;
  const eye = secureTextEntry && !right;
  const trailing = eye ? (
    <Press onPress={() => setRevealed(r => !r)} hitSlop={10} style={styles.eyeBtn} accessibilityRole="button" accessibilityLabel={revealed ? 'Hide password' : 'Show password'}>
      <EyeIcon open={revealed} />
    </Press>
  ) : (
    right
  );

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.fieldRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secureTextEntry && !revealed}
          keyboardType={keyboardType}
          // a revealed password must not get auto-capitalised or autocorrected
          autoCapitalize={secureTextEntry ? 'none' : autoCapitalize}
          autoCorrect={secureTextEntry ? false : autoCorrect}
          placeholder={placeholder}
          placeholderTextColor={C.ink3}
          editable={editable}
          style={[styles.input, { borderColor }, trailing && (eye ? styles.inputWithEye : styles.inputWithRight), !editable && styles.inputDisabled]}
        />
        {trailing ? <View style={styles.right}>{trailing}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontFamily: SANS.medium,
    fontSize: 14,
    color: C.ink2,
    marginBottom: 7,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 14,
    fontFamily: SANS.regular,
    fontSize: 16,
    color: C.ink,
    backgroundColor: 'rgba(22,36,28,0.05)',
  },
  inputDisabled: { opacity: 0.6 },
  fieldRow: { justifyContent: 'center' },
  inputWithRight: { paddingRight: 96 },
  inputWithEye: { paddingRight: 48 },
  right: { position: 'absolute', right: 10, flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { padding: 6 },
  error: {
    fontFamily: SANS.regular,
    fontSize: 12.5,
    color: C.stage2,
    marginTop: 6,
  },
  hint: {
    fontFamily: SANS.medium,
    fontSize: 12.5,
    color: C.brand2,
    marginTop: 6,
  },
});
