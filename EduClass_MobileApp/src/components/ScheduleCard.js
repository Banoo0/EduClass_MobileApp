import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Chip from './Chip';
import { formatJam } from '../utils/dateHelper';
import { colors, fontSize, fontWeight, radius, spacing } from '../core/theme';

// Label chip per status, untuk layout siswa (huruf besar, seperti mockup) dan guru.
const STATUS = {
  active: { tone: 'success', dot: true, student: 'AKTIF', teacher: 'Sedang Berlangsung' },
  upcoming: { tone: 'neutral', dot: false, student: 'MENDATANG', teacher: 'Mendatang' },
  done: { tone: 'neutral', dot: false, student: 'SELESAI', teacher: 'Selesai' },
};

// Kartu jadwal. status dihitung oleh layar: 'active' | 'upcoming' | 'done'.
// layout 'student': jam di kiri atas, "lokasi • guru" di bawah judul.
// layout 'teacher': chip di kiri atas, jam + timeNote di kanan, children untuk tombol tambahan.
export default function ScheduleCard({
  layout = 'student',
  status = 'upcoming',
  statusLabel,
  start,
  end,
  timeNote,
  title,
  location,
  teacher,
  children,
  style,
}) {
  const s = STATUS[status] ?? STATUS.upcoming;
  const active = status === 'active';
  const timeText = [formatJam(start), formatJam(end)].filter(Boolean).join(' - ');
  const chip = <Chip label={statusLabel ?? s[layout === 'teacher' ? 'teacher' : 'student']} tone={s.tone} dot={s.dot} />;
  const timeColor = active ? colors.success : colors.textMuted;

  return (
    <View style={[styles.card, { borderLeftColor: active ? colors.success : colors.border }, status === 'done' && styles.done, style]}>
      {layout === 'teacher' ? (
        <View style={styles.teacherRow}>
          <View style={styles.flex}>
            {chip}
            <Text style={[styles.title, styles.titleTeacher]} numberOfLines={2}>
              {title}
            </Text>
            {location ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={fontSize.md} color={colors.textMuted} />
                <Text style={styles.sub} numberOfLines={2}>
                  {location}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.timeCol}>
            <Text style={[styles.timeBig, { color: active ? colors.success : colors.text }]}>{timeText}</Text>
            {timeNote ? (
              <Text style={styles.note} numberOfLines={1}>
                {timeNote}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.studentTop}>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={fontSize.md} color={timeColor} />
              <Text style={[styles.time, { color: timeColor }]}>{timeText}</Text>
            </View>
            {chip}
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {location || teacher ? (
            <Text style={styles.sub} numberOfLines={1}>
              {[location, teacher].filter(Boolean).join(' • ')}
            </Text>
          ) : null}
        </>
      )}

      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderLeftWidth: 4, padding: spacing.md },
  done: { opacity: 0.6 },
  flex: { flex: 1 },
  studentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  time: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: spacing.sm },
  titleTeacher: { fontSize: fontSize.xl },
  sub: { flexShrink: 1, color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  teacherRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.xs },
  timeCol: { alignItems: 'flex-end' },
  timeBig: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  note: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
});
