import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, radius, spacing } from '../core/theme';

const TONES = {
  primary: { fg: colors.primary, bg: colors.primarySoft },
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  neutral: { fg: colors.textMuted, bg: colors.cardAlt },
};

// Label kecil berwarna untuk badge status, chip mapel, chip tenggat, dll.
// tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
// shape: 'pill' (bulat penuh) | 'rounded' (sudut kecil, seperti chip "Matematika - 9A")
export default function Chip({ label, tone = 'neutral', icon, dot = false, shape = 'pill', style }) {
  const t = TONES[tone] ?? TONES.neutral;
  return (
    <View style={[styles.chip, { backgroundColor: t.bg, borderRadius: shape === 'pill' ? radius.pill : radius.sm }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: t.fg }]} /> : null}
      {icon ? <Ionicons name={icon} size={fontSize.sm} color={t.fg} style={styles.icon} /> : null}
      <Text style={[styles.text, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + spacing.xs,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: spacing.xs + 2 },
  icon: { marginRight: spacing.xs },
  text: { flexShrink: 1, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
});
