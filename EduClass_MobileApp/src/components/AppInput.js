import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../core/theme';

// Input bergaya mockup: label kecil di atas, tanda * untuk wajib, border berubah saat fokus/error.
const AppInput = forwardRef(function AppInput(
  { label, required, hint, error, icon, secureTextEntry, ...props },
  ref
) {
  const { multiline, style: inputStyle, ...inputProps } = props;
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
          {hint ? <Text style={styles.hint}>  {hint}</Text> : null}
        </Text>
      ) : null}
      <View style={[styles.field, multiline && styles.multilineField, focused && styles.focused, !!error && styles.errorBorder]}>
        {icon ? <Ionicons name={icon} size={18} color={focused ? colors.primary : colors.textMuted} style={styles.icon} /> : null}
        <TextInput
          ref={ref}
          style={[styles.input, multiline && styles.multilineInput, inputStyle]}
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.primary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={hidden}
          multiline={multiline}
          {...inputProps}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={12} accessibilityLabel={hidden ? 'Tampilkan password' : 'Sembunyikan password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

export default AppInput;

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  required: { color: colors.danger },
  hint: { color: colors.textFaint, fontWeight: '400' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  multilineField: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingVertical: 8,
  },
  focused: { borderColor: colors.primary },
  errorBorder: { borderColor: colors.danger },
  icon: { marginRight: 10 },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12 },
  multilineInput: {
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
    minHeight: 96,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
  },
  error: { color: colors.danger, fontSize: 12.5, marginTop: 6 },
});
