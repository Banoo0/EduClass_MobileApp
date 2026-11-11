import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Chip from './Chip';
import { formatDeadline } from '../utils/dateHelper';
import { colors, fontSize, fontWeight, radius, spacing } from '../core/theme';

const STRIPE = { danger: colors.danger, warning: colors.warning, neutral: colors.border };

// Kartu tugas untuk guru: chip mapel + tenggat, judul, progres pengumpulan, jumlah belum dinilai.
// Gaya sama dengan TaskCard. Tautan "Periksa" hanya muncul jika onPress diisi.
export default function SubmissionCard({ subject, kelas, title, dueAt, submitted = 0, total = 0, ungraded = 0, onPress, style }) {
  const due = formatDeadline(dueAt);
  const subjectLabel = [subject, kelas].filter(Boolean).join(' - ');
  const ratio = total ? Math.min(submitted / total, 1) : 0;
  const lengkap = total > 0 && submitted >= total;

  let gradeChip = <Chip label={`${ungraded} belum dinilai`} tone="danger" dot />;
  if (submitted === 0) gradeChip = <Chip label="Belum ada pengumpulan" />;
  else if (ungraded === 0) gradeChip = <Chip label="Semua sudah dinilai" tone="success" icon="checkmark-circle-outline" />;

  return (
    <View style={[styles.card, { borderLeftColor: STRIPE[due.tone] }, style]}>
      <View style={styles.chipRow}>
        {subjectLabel ? <Chip label={subjectLabel} tone="primary" shape="rounded" style={styles.subjectChip} /> : <View />}
        <Chip label={due.label} tone={due.tone} icon={due.icon} />
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>

      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          <Text style={styles.progressStrong}>
            {submitted}/{total}
          </Text>{' '}
          terkumpul
        </Text>
        <Text style={styles.percent}>{Math.round(ratio * 100)}%</Text>
      </View>
      <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: submitted }}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: lengkap ? colors.success : colors.primary }]} />
      </View>

      <View style={styles.footer}>
        {gradeChip}
        {onPress ? (
          <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
            <Text style={styles.actionText}>Periksa</Text>
            <Ionicons name="chevron-forward" size={fontSize.md} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderLeftWidth: 4, padding: spacing.md },
  chipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  subjectChip: { marginRight: 'auto' },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, lineHeight: 24, marginTop: spacing.sm + spacing.xs },
  progressRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.sm + spacing.xs },
  progressText: { color: colors.textMuted, fontSize: fontSize.sm },
  progressStrong: { color: colors.text, fontWeight: fontWeight.bold },
  percent: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.cardAlt, marginTop: spacing.sm, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
