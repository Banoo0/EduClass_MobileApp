import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../core/theme';

// variant: 'primary' (biru) | 'success' (hijau, seperti tombol Submit) | 'outline' | 'danger'
export default function AppButton({ title, onPress, variant = 'primary', loading = false, disabled = false, icon, style }) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={v.text} style={{ marginRight: 8 }} /> : null}
          <Text style={[styles.text, { color: v.text }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const VARIANTS = {
  primary: { bg: colors.primary, border: colors.primary, text: '#FFFFFF' },
  success: { bg: colors.success, border: colors.success, text: '#FFFFFF' },
  outline: { bg: 'transparent', border: colors.border, text: colors.text },
  danger: { bg: colors.dangerSoft, border: 'rgba(248,113,113,0.35)', text: colors.danger },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  text: { fontSize: 15.5, fontWeight: '700' },
});