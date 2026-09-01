import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { C } from '../../theme/colors';
import { SANS } from '../../theme/typography';

/* Bordered, filled text field matching the look already established
   by AskDialogContext's inline TextInput — this is the same style
   promoted to a reusable atom, since Login/Register need several of
   these and no Input atom existed yet. */
export default function Input({ label, value, onChangeText, error, secureTextEntry, keyboardType, autoCapitalize = 'sentences', placeholder, editable = true }) {
  const [focused, setFocused] = useState(false);

  const borderColor = error ? C.stage2 : focused ? C.brand : C.hair;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholder={placeholder}
        placeholderTextColor={C.ink3}
        editable={editable}
        style={[styles.input, { borderColor }, !editable && styles.inputDisabled]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  error: {
    fontFamily: SANS.regular,
    fontSize: 12.5,
    color: C.stage2,
    marginTop: 6,
  },
});
