import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Chip from './Chip';
import { colors, fontSize, fontWeight, radius, spacing } from '../core/theme';

// Judul bagian di Beranda, contoh: "Tugas Mendesak (2)  ...  Lihat Semua >"
// count: badge angka merah (opsional) | chip: { label, icon } di kanan (opsional)
// onAction: tampilkan tautan actionLabel di kanan (opsional)
export default function SectionHeader({ title, count, subtitle, chip, actionLabel = 'Lihat Semua', onAction, style }) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.titleWrap}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {typeof count === 'number' ? (
            <View style={styles.count}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {chip ? <Chip label={chip.label} icon={chip.icon} style={styles.right} /> : null}

      {onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="link" style={({ pressed }) => [styles.action, styles.right, pressed && { opacity: 0.7 }]}>
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={fontSize.md} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  titleWrap: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flexShrink: 1, color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  count: {
    minWidth: 24,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
  },
  countText: { color: colors.danger, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  right: { marginLeft: spacing.sm, flexShrink: 0 },
  action: { flexDirection: 'row', alignItems: 'center' },
  actionText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
