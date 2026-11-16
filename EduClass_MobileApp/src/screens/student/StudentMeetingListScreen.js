import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../components/DashboardHeader';
import FormAlert from '../../components/FormAlert';
import { useAuth } from '../../context/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '../../core/theme';
import { fetchStudentClassMeetings } from '../../services/meetingService';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const ATTENDANCE_LABELS = { hadir: 'Hadir', izin: 'Izin', sakit: 'Sakit', alpa: 'Tidak hadir' };

function getMeetingStatus(meeting) {
  if (!meeting.tanggal || !meeting.jam_mulai || !meeting.jam_selesai) return 'Mendatang';
  const start = new Date(`${meeting.tanggal}T${meeting.jam_mulai.slice(0, 5)}:00`).getTime();
  const end = new Date(`${meeting.tanggal}T${meeting.jam_selesai.slice(0, 5)}:00`).getTime();
  if (Date.now() >= end) return 'Selesai';
  if (Date.now() >= start) return 'Aktif';
  return 'Mendatang';
}

function formatMeetingDate(value) {
  const [year, month, day] = String(value || '').slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value || 'Tanggal belum diatur';
  const date = new Date(year, month - 1, day, 12);
  return `${DAY_NAMES[date.getDay()]}, ${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

export default function StudentMeetingListScreen({ route, navigation }) {
  const { user, profile } = useAuth();
  const studentId = user?.uid || user?.id || profile?.id;
  const { classId, className, semester, tahunAjaran } = route.params;
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadMeetings = useCallback(async (refresh = false) => {
    if (!studentId) {
      setMeetings([]);
      setError('Akun siswa tidak ditemukan. Silakan login ulang.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const { data, error: requestError } = await fetchStudentClassMeetings({ classId, studentId });
      if (requestError) throw requestError;
      setMeetings(data || []);
    } catch (err) {
      setError(err.message || 'Gagal memuat daftar pertemuan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId, studentId]);

  useFocusEffect(useCallback(() => { loadMeetings(); }, [loadMeetings]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DashboardHeader variant="siswa" title="Pertemuan" onAvatarPress={() => navigation.getParent()?.navigate('Profil')} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMeetings(true)} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color={colors.primary} />
          <Text style={styles.backText}>Kembali ke kelas</Text>
        </Pressable>
        <Text style={styles.title}>{className || 'Kelas'}</Text>
        <Text style={styles.subtitle}>
          Daftar Pertemuan{semester ? ` • Semester ${semester}` : ''}{tahunAjaran ? ` • ${tahunAjaran}` : ''}
        </Text>
        <View style={styles.countBar}>
          <Ionicons name="calendar-outline" size={17} color={colors.primary} />
          <Text style={styles.countText}>{meetings.length} Pertemuan</Text>
        </View>

        <FormAlert message={error} />
        {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : meetings.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={30} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>Belum ada pertemuan</Text>
            <Text style={styles.emptyText}>Pertemuan yang dibuat guru akan tampil di sini.</Text>
          </View>
        ) : meetings.map((meeting) => {
          const status = getMeetingStatus(meeting);
          const attendance = meeting.attendance?.status;
          return (
            <View key={meeting.id} style={[styles.meetingCard, status === 'Aktif' && styles.meetingCardActive]}>
              <View style={styles.meetingTopRow}>
                <Text style={styles.meetingNumber}>PERTEMUAN {meeting.pertemuan_ke}</Text>
                <View style={[styles.statusPill, status === 'Aktif' ? styles.activePill : status === 'Selesai' ? styles.donePill : styles.upcomingPill]}>
                  <Text style={[styles.statusText, status === 'Aktif' ? styles.activeText : status === 'Selesai' ? styles.doneText : styles.upcomingText]}>{status}</Text>
                </View>
                {status === 'Aktif' ? <Ionicons name="chevron-forward" size={20} color={colors.primary} /> : null}
              </View>
              <Text style={styles.meetingTitle}>{meeting.topik || 'Tanpa judul'}</Text>
              {meeting.deskripsi ? <Text style={styles.meetingDescription}>{meeting.deskripsi}</Text> : null}
              <View style={styles.dateLine}>
                <Ionicons name="time-outline" size={16} color={status === 'Aktif' ? colors.primary : colors.textMuted} />
                <Text style={[styles.dateText, status === 'Aktif' && styles.dateTextActive]}>
                  {formatMeetingDate(meeting.tanggal)} • {meeting.jam_mulai?.slice(0, 5) || '--:--'} – {meeting.jam_selesai?.slice(0, 5) || '--:--'} WIB
                </Text>
              </View>
              <View style={styles.attendanceLine}>
                <Ionicons name={attendance === 'hadir' ? 'checkmark-circle' : attendance === 'alpa' ? 'close-circle' : 'information-circle-outline'} size={16} color={attendance === 'hadir' ? colors.success : attendance === 'alpa' ? colors.danger : colors.textMuted} />
                <Text style={styles.attendanceText}>
                  Status presensi: {attendance ? ATTENDANCE_LABELS[attendance] || attendance : 'Belum dicatat'}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: 36 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  backText: { color: colors.primary, fontWeight: fontWeight.semibold },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 5, marginBottom: 16 },
  countBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  countText: { marginLeft: 'auto', color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  loading: { marginTop: 28 },
  empty: { alignItems: 'center', gap: 8, padding: 26, backgroundColor: colors.card, borderRadius: radius.md },
  emptyTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: 4 },
  emptyText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  meetingCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: 12 },
  meetingCardActive: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  meetingTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meetingNumber: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.4, marginRight: 'auto' },
  statusPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill },
  activePill: { backgroundColor: colors.primarySoft },
  donePill: { backgroundColor: colors.successSoft },
  upcomingPill: { backgroundColor: colors.cardAlt },
  statusText: { fontSize: 10, fontWeight: fontWeight.bold },
  activeText: { color: colors.primary },
  doneText: { color: colors.success },
  upcomingText: { color: colors.textMuted },
  meetingTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: 12 },
  meetingDescription: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20, marginTop: 6 },
  dateLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  dateText: { color: colors.textMuted, fontSize: fontSize.xs, flex: 1 },
  dateTextActive: { color: '#A7C5FF' },
  attendanceLine: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 11 },
  attendanceText: { color: colors.textMuted, fontSize: fontSize.xs },
});
