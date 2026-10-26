import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from './AppButton.js';
import Chip from './Chip';
import { formatDeadline } from '../utils/dateHelper';
import { colors, fontSize, fontWeight, radius, spacing } from '../core/theme';

const STRIPE = { danger: colors.danger, warning: colors.warning, neutral: colors.border };

// Kartu tugas: garis warna di kiri, chip mapel + tenggat, judul, guru + keterangan, tombol Detail/Submit.
// dueAt berupa ISO UTC dari database. Tombol hanya muncul jika onDetail / onSubmit diisi.
export default function TaskCard({
  subject,
  kelas,
  title,
  dueAt,
  teacher,
  info,
  infoIcon = 'document-text-outline',
  onDetail,
  onSubmit,
  style,
}) {
  const due = formatDeadline(dueAt);
  const subjectLabel = [subject, kelas].filter(Boolean).join(' - ');

  return (
    <View style={[styles.card, { borderLeftColor: STRIPE[due.tone] }, style]}>
      <View style={styles.chipRow}>
        {subjectLabel ? <Chip label={subjectLabel} tone="primary" shape="rounded" style={styles.subjectChip} /> : <View />}
        <Chip label={due.label} tone={due.tone} icon={due.icon} />
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>

      {teacher || info ? (
        <View style={styles.metaRow}>
          {teacher ? (
            <>
              <Ionicons name="person-outline" size={fontSize.sm} color={colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {teacher}
              </Text>
            </>
          ) : null}
          {teacher && info ? <Text style={styles.dot}>•</Text> : null}
          {info ? (
            <>
              <Ionicons name={infoIcon} size={fontSize.sm} color={colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {info}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}

      {onDetail || onSubmit ? (
        <View style={styles.actions}>
          {onDetail ? (
            <AppButton title="Detail" icon="information-circle-outline" variant="outline" onPress={onDetail} style={[styles.button, styles.detail]} />
          ) : null}
          {onSubmit ? (
            <AppButton title="Submit" icon="checkmark-circle-outline" variant="success" onPress={onSubmit} style={styles.button} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    padding: spacing.md,
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  subjectChip: { marginRight: 'auto' },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, lineHeight: 24, marginTop: spacing.sm + spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  metaText: { flexShrink: 1, color: colors.textMuted, fontSize: fontSize.sm },
  dot: { color: colors.textFaint, fontSize: fontSize.sm, marginHorizontal: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  button: { flex: 1, minHeight: 44 },
  detail: { backgroundColor: colors.cardAlt, borderColor: colors.cardAlt },
});
