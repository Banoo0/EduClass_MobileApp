import { useCallback, useMemo, useState, useRef } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FloatingSafeAreaView } from '../../components/FloatingTabBar';
import AppBackdrop from '../../components/AppBackdrop';
import MonthlyCalendar from '../../components/MonthlyCalendar';
import DashboardHeader from '../../components/DashboardHeader';
import FormAlert from '../../components/FormAlert';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { fetchTeacherWeekMeetings } from '../../services/meetingService';
import { spacing, radius, fontSize, fontWeight } from '../../core/theme';

const keyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const time = (value) => String(value || '--:--').slice(0, 5);

export default function JadwalScreen({ navigation }) {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const { user, profile } = useAuth();
  const teacherId = user?.uid || user?.id || profile?.id;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const selectedKey = keyOf(selectedDate);
  const todayDate = new Date();
  const todayKey = keyOf(todayDate);
  const rangeStart = keyOf(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const rangeEnd = keyOf(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0));
  const requestRef = useRef(0);

  const loadMeetings = useCallback(async (refresh = false) => {
    const request = ++requestRef.current;
    if (!teacherId) {
      setMeetings([]);
      setError('Akun guru tidak ditemukan. Silakan login ulang.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    const result = await fetchTeacherWeekMeetings({ teacherId, weekStartKey: rangeStart, weekEndKey: rangeEnd });
    if (request !== requestRef.current) return;
    if (result.error) setError(result.error.message || 'Gagal memuat pertemuan.');
    setMeetings(result.data || []);
    setLoading(false);
    setRefreshing(false);
  }, [teacherId, rangeStart, rangeEnd]);

  useFocusEffect(useCallback(() => { loadMeetings(); return () => { requestRef.current++; }; }, [loadMeetings]));
  const selectedMeetings = useMemo(() => meetings
    .filter((meeting) => String(meeting.tanggal || '').slice(0, 10) === selectedKey)
    .sort((a, b) => String(a.jam_mulai || '').localeCompare(String(b.jam_mulai || ''))), [meetings, selectedKey]);
  const markers = useMemo(() => Object.fromEntries(meetings.map((meeting) => [String(meeting.tanggal || '').slice(0, 10), ['#3B82F6']])), [meetings]);
  const heading = selectedDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <FloatingSafeAreaView style={styles.safe} edges={['top']}>
      <AppBackdrop />
      <DashboardHeader variant="guru" title="Jadwal" onAvatarPress={() => navigation.navigate('Profil')} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMeetings(true)} tintColor={colors.primary} />}>
        <MonthlyCalendar selectedDateKey={selectedKey} onChange={(key) => { const [y,m,d] = key.split('-').map(Number); setSelectedDate(new Date(y,m-1,d)); }} dateMarkers={markers} />
        <Text style={styles.heading}>{heading}</Text>
        <FormAlert message={error} />
        {loading ? <ActivityIndicator style={{ padding: 28 }} color={colors.primary} /> : selectedMeetings.length === 0 ? (
          <View style={styles.empty}><Ionicons name="calendar-clear-outline" size={28} color={colors.textMuted} /><Text style={styles.emptyTitle}>Belum ada pertemuan</Text><Text style={styles.muted}>Buat pertemuan melalui Kelola Kelas.</Text></View>
        ) : selectedMeetings.map((meeting) => {
          const klass = meeting.classes || {};
          const start = new Date(`${meeting.tanggal}T${time(meeting.jam_mulai)}:00`);
          const end = new Date(`${meeting.tanggal}T${time(meeting.jam_selesai)}:00`);
          const status = selectedKey < todayKey ? 'Selesai' : selectedKey > todayKey ? 'Mendatang' : (start <= new Date() && end > new Date() ? 'Berlangsung' : start > new Date() ? 'Mendatang' : 'Selesai');
          return <View key={meeting.id} style={styles.card}>
            <View style={styles.cardTop}><Text style={styles.badge}>PERTEMUAN {meeting.pertemuan_ke}</Text><Text style={[styles.status, status === 'Berlangsung' && styles.live]}>{status}</Text></View>
            <Text style={styles.title}>{meeting.topik || klass.nama_mapel || 'Pertemuan'}</Text>
            <Text style={styles.className}>{[klass.nama_mapel, klass.rombel].filter(Boolean).join(' • ')}</Text>
            <View style={styles.meta}><Ionicons name="time-outline" size={16} color={colors.textMuted} /><Text style={styles.muted}>{time(meeting.jam_mulai)} – {time(meeting.jam_selesai)}</Text></View>
            <Pressable style={styles.button} onPress={() => navigation.navigate('KelolaKelas', { screen: 'KelolaPertemuan', params: { classId: meeting.class_id, className: [klass.nama_mapel, klass.rombel].filter(Boolean).join(' '), semester: klass.semester, tahunAjaran: klass.tahun_ajaran } })}>
              <Ionicons name="open-outline" size={17} color={colors.primary} /><Text style={styles.buttonText}>Kelola Pertemuan</Text>
            </Pressable>
          </View>;
        })}
      </ScrollView>
    </FloatingSafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  dateStrip: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  dateCard: { width: 62, height: 76, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md },
  dateSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateDay: { color: colors.textMuted, fontSize: fontSize.xs },
  dateNumber: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  dateTextSelected: { color: '#FFFFFF' },
  dateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent' },
  dateDotMarked: { backgroundColor: colors.primary },
  dateDotSelected: { backgroundColor: '#FFFFFF' },
  dateDotHidden: { opacity: 0 },
  heading: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.card, borderRadius: radius.lg },
  emptyTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  card: { padding: spacing.md, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, gap: spacing.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { color: colors.primary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  status: { color: colors.textMuted, fontSize: fontSize.xs },
  live: { color: colors.success },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  className: { color: colors.textMuted, fontSize: fontSize.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primarySoft, marginTop: spacing.xs },
  buttonText: { color: colors.primary, fontWeight: fontWeight.bold },
});
