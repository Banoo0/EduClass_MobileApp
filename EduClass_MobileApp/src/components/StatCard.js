import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Chip from './Chip';
import { colors, fontSize, fontWeight, radius, spacing } from '../core/theme';

const VARIANTS = {
  danger: { fg: colors.danger, soft: colors.dangerSoft },
  primary: { fg: colors.primary, soft: colors.primarySoft },
  success: { fg: colors.success, soft: colors.successSoft },
  neutral: { fg: colors.textMuted, soft: colors.cardAlt },
};

// Kartu angka ringkasan.
// labelPosition 'bottom' = gaya Beranda siswa (ikon + badge di atas, label di bawah angka)
// labelPosition 'top'    = gaya Beranda guru (label + ikon di atas, angka + extra di bawah)
// valueColored / extraColored: beri warna variant pada angka / teks tambahan.
export default function StatCard({
  variant = 'neutral',
  icon,
  badge,
  value,
  label,
  extra,
  labelPosition = 'bottom',
  valueColored = false,
  extraColored = false,
  style,
}) {
  const v = VARIANTS[variant] ?? VARIANTS.neutral;

  const iconBox = icon ? (
    <View style={[styles.iconBox, { backgroundColor: v.soft }]}>
      <Ionicons name={icon} size={20} color={v.fg} />
    </View>
  ) : null;

  return (
    <View style={[styles.card, style]}>
      {/* Pengganti efek cahaya di pojok kanan atas mockup */}
      {variant !== 'neutral' ? <View style={[styles.glow, { backgroundColor: v.soft }]} /> : null}

      {labelPosition === 'top' ? (
        <View style={styles.topRow}>
          <Text style={[styles.label, styles.labelTop]} numberOfLines={2}>
            {label}
          </Text>
          {iconBox}
        </View>
      ) : (
        <View style={styles.topRow}>
          {iconBox}
          {badge ? <Chip label={badge} tone={variant} style={styles.badge} /> : null}
        </View>
      )}

      <View style={styles.valueRow}>
        <Text style={[styles.value, valueColored && { color: v.fg }]} numberOfLines={1}>
          {value}
        </Text>
        {extra ? (
          <Text style={[styles.extra, extraColored && { color: v.fg }]} numberOfLines={1}>
            {extra}
          </Text>
        ) : null}
      </View>

      {labelPosition === 'bottom' ? (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    overflow: 'hidden',
  },
  glow: { position: 'absolute', top: -48, right: -48, width: 120, height: 120, borderRadius: 60 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  iconBox: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  badge: { marginLeft: spacing.sm },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  value: { color: colors.text, fontSize: fontSize.display, fontWeight: fontWeight.heavy },
  extra: { flexShrink: 1, color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginLeft: spacing.sm },
  label: { color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.xs },
  labelTop: { flex: 1, marginTop: 0, marginRight: spacing.sm, color: colors.text, fontWeight: fontWeight.semibold },
});
