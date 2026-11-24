import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../components/DashboardHeader';
import AppButton from '../../components/AppButton';
import AppInput from '../../components/AppInput';
import FormAlert from '../../components/FormAlert';
import { useAuth } from '../../context/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '../../core/theme';
import { createMeeting, deleteMeeting, fetchClassMeetings, fetchMeetingRoster, saveMeetingAttendance, setMeetingAttendanceOpen, updateMeeting } from '../../services/meetingService';

const ATTENDANCE_STATUSES = [
  { value: 'hadir', label: 'Hadir' },
  { value: 'izin', label: 'Izin' },
  { value: 'sakit', label: 'Sakit' },
  { value: 'alpa', label: 'Alpa' },
];
const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function validDate(value) {
  const parts = String(value).split('-').map(Number);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || parts.length !== 3) return false;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2];
}

function dayForDate(value) {
  if (!validDate(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  return DAY_NAMES[new Date(year, month - 1, day).getDay()];
}

function meetingStatus(meeting) {
  if (!validDate(meeting.tanggal) || !meeting.jam_mulai || !meeting.jam_selesai) return 'Mendatang';
  const start = new Date(`${meeting.tanggal}T${meeting.jam_mulai.slice(0, 5)}:00`);
  const end = new Date(`${meeting.tanggal}T${meeting.jam_selesai.slice(0, 5)}:00`);
  const now = Date.now();
  if (now >= end.getTime()) return 'Selesai';
  if (now >= start.getTime()) return 'Aktif';
  return 'Mendatang';
}

function dateLabel(value) {
  if (!validDate(value)) return value || 'Tanggal belum diatur';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function notify(title, message) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function confirmAction(title, message, onConfirm) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

function isAttendanceOpen(meeting) {
  const openedAt = meeting.presensi_dibuka_at?.toDate?.()?.getTime?.()
    ?? new Date(meeting.presensi_dibuka_at || 0).getTime();
  const closedAt = meeting.presensi_ditutup_at?.toDate?.()?.getTime?.()
    ?? new Date(meeting.presensi_ditutup_at || 0).getTime();
  return Boolean(meeting.presensi_dibuka_at && openedAt <= Date.now() && (!meeting.presensi_ditutup_at || closedAt > Date.now()));
}

export default function MeetingManagementScreen({ route, navigation }) {
  const { user, profile } = useAuth();
  const teacherId = user?.uid || user?.id || profile?.id;
  const { classId, className, semester, tahunAjaran, jumlahSiswa } = route.params;
  const [meetings, setMeetings] = useState([]);
  const [rosters, setRosters] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [tanggal, setTanggal] = useState(todayString());
  const [jamMulai, setJamMulai] = useState('08:30');
  const [jamSelesai, setJamSelesai] = useState('10:00');
  const [topik, setTopik] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTanggal, setEditTanggal] = useState('');
  const [editJamMulai, setEditJamMulai] = useState('');
  const [editJamSelesai, setEditJamSelesai] = useState('');
  const [editTopik, setEditTopik] = useState('');
  const [editDeskripsi, setEditDeskripsi] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const nextNumber = useMemo(
    () => meetings.reduce((maximum, item) => Math.max(maximum, Number(item.pertemuan_ke) || 0), 0) + 1,
    [meetings]
  );

  const loadMeetings = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await fetchClassMeetings(classId);
      if (result.error) throw result.error;
      setMeetings(result.data || []);
    } catch (err) {
      setError(err.message || 'Gagal memuat pertemuan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId]);

  useFocusEffect(useCallback(() => { loadMeetings(); }, [loadMeetings]));

  const validateForm = (date, start, end, title, description) => {
    if (!validDate(date)) return 'Tanggal harus berformat YYYY-MM-DD.';
    if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end) || end <= start) return 'Jam selesai harus setelah jam mulai.';
    if (!title.trim() || !description.trim()) return 'Judul dan deskripsi pertemuan wajib diisi.';
    return '';
  };

  const handleCreate = async () => {
    const validationError = validateForm(tanggal, jamMulai, jamSelesai, topik, deskripsi);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!teacherId) {
      setError('Akun guru tidak ditemukan. Silakan login ulang.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const { error: createError } = await createMeeting({
        classId,
        teacherId,
        pertemuanKe: nextNumber,
        tanggal,
        jam_mulai: jamMulai,
        jam_selesai: jamSelesai,
        topik,
        deskripsi,
      });
      if (createError) throw createError;
      setTopik('');
      setDeskripsi('');
      setShowCreate(false);
      await loadMeetings(true);
      notify('Pertemuan dibuat', `Pertemuan ${nextNumber} berhasil ditambahkan.`);
    } catch (err) {
      setError(err.message || 'Gagal membuat pertemuan.');
      await loadMeetings(true);
    } finally {
      setCreating(false);
    }
  };

  const beginEdit = (meeting) => {
    setEditingId(meeting.id);
    setEditTanggal(meeting.tanggal || todayString());
    setEditJamMulai(meeting.jam_mulai?.slice(0, 5) || '08:30');
    setEditJamSelesai(meeting.jam_selesai?.slice(0, 5) || '10:00');
    setEditTopik(meeting.topik || '');
    setEditDeskripsi(meeting.deskripsi || '');
    setError('');
  };

  const handleUpdate = async (meetingId) => {
    const validationError = validateForm(editTanggal, editJamMulai, editJamSelesai, editTopik, editDeskripsi);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusyId(meetingId);
    setError('');
    try {
      const { data, error: saveError } = await updateMeeting({
        meetingId,
        tanggal: editTanggal,
        jam_mulai: editJamMulai,
        jam_selesai: editJamSelesai,
        topik: editTopik,
        deskripsi: editDeskripsi,
      });
      if (saveError) throw saveError;
      setMeetings((previous) => previous.map((row) => row.id === meetingId ? data : row)
        .sort((a, b) => Number(a.pertemuan_ke) - Number(b.pertemuan_ke)));
      setEditingId(null);
    } catch (err) {
      setError(err.message || 'Gagal mengubah pertemuan.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (meeting) => confirmAction(
    'Hapus pertemuan?',
    'Pertemuan dan catatan presensinya akan dihapus permanen.',
    async () => {
      setBusyId(meeting.id);
      setError('');
      try {
        const { data, error: deleteError } = await deleteMeeting(meeting.id);
        if (deleteError) throw deleteError;
        if (!data) throw new Error('Pertemuan tidak ditemukan atau tidak dapat dihapus.');
        setMeetings((previous) => previous.filter((row) => row.id !== meeting.id));
        setRosters((previous) => {
          const next = { ...previous };
          delete next[meeting.id];
          return next;
        });
        if (expandedId === meeting.id) setExpandedId(null);
        if (editingId === meeting.id) setEditingId(null);
      } catch (err) {
        setError(err.message || 'Gagal menghapus pertemuan.');
      } finally {
        setBusyId(null);
      }
    }
  );

  const handleToggleOpen = async (meeting) => {
    setBusyId(meeting.id);
    setError('');
    try {
      const { data, error: updateError } = await setMeetingAttendanceOpen(meeting, !isAttendanceOpen(meeting));
      if (updateError) throw updateError;
      setMeetings((previous) => previous.map((row) => row.id === meeting.id ? { ...row, ...data } : row));
    } catch (err) {
      setError(err.message || 'Gagal mengubah status presensi.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleRoster = async (meeting) => {
    if (expandedId === meeting.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(meeting.id);
    if (rosters[meeting.id]) return;
    setBusyId(meeting.id);
    setError('');
    try {
      const { data, error: rosterError } = await fetchMeetingRoster(classId, meeting.id);
      if (rosterError) throw rosterError;
      setRosters((previous) => ({ ...previous, [meeting.id]: data || [] }));
    } catch (err) {
      setError(err.message || 'Gagal memuat daftar siswa.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSetStatus = async (meetingId, studentId, status) => {
    const student = (rosters[meetingId] || []).find((row) => row.id === studentId);
    if (!student || student.attendance?.status === status) return;
    setBusyId(`${meetingId}:${studentId}`);
    setError('');
    try {
      const { data, error: saveError } = await saveMeetingAttendance({ meetingId, studentId, status });
      if (saveError) throw saveError;
      setRosters((previous) => ({
        ...previous,
        [meetingId]: (previous[meetingId] || []).map((row) => row.id === studentId ? { ...row, attendance: data } : row),
      }));
    } catch (err) {
      setError(err.message || 'Gagal menyimpan presensi siswa.');
    } finally {
      setBusyId(null);
    }
  };

  const classMeta = [semester && `Semester ${semester}`, tahunAjaran, `${jumlahSiswa || 0} Siswa`].filter(Boolean).join(' • ');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DashboardHeader variant="guru" title="Daftar Pertemuan" onAvatarPress={() => navigation.getParent()?.navigate('Profil')} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMeetings(true)} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color={colors.primary} />
          <Text style={styles.backText}>Kembali ke kelas</Text>
        </Pressable>
        <Text style={styles.title}>{className || 'Kelas'}</Text>
        <Text style={styles.subtitle}>{classMeta || 'Atur pertemuan untuk kelas ini'}</Text>

        <Pressable style={styles.addMeetingButton} onPress={() => { setShowCreate((shown) => !shown); setError(''); }}>
          <Ionicons name={showCreate ? 'close' : 'add-circle-outline'} size={19} color={colors.primary} />
          <Text style={styles.addMeetingText}>{showCreate ? 'Tutup formulir' : 'Tambah pertemuan'}</Text>
          {!showCreate ? <Text style={styles.nextNumber}>Pertemuan {nextNumber}</Text> : null}
        </Pressable>

        {showCreate ? <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <View style={styles.formNumberBadge}><Text style={styles.formNumberText}>{nextNumber}</Text></View>
            <View style={styles.formHeaderText}>
              <Text style={styles.sectionTitle}>Pertemuan {nextNumber}</Text>
              <Text style={styles.helperInline}>Hari otomatis mengikuti tanggal.</Text>
            </View>
          </View>
          <AppInput label="Tanggal" required value={tanggal} onChangeText={setTanggal} placeholder="YYYY-MM-DD" autoCapitalize="none" />
          <View style={styles.dayPreview}>
            <Ionicons name="calendar-outline" size={17} color={colors.primary} />
            <Text style={styles.dayPreviewText}>Hari: {dayForDate(tanggal) || 'Pilih tanggal yang valid'}</Text>
          </View>
          <View style={styles.timeRow}>
            <View style={styles.timeField}><AppInput label="Jam mulai" required value={jamMulai} onChangeText={setJamMulai} placeholder="08:30" /></View>
            <View style={styles.timeField}><AppInput label="Jam selesai" required value={jamSelesai} onChangeText={setJamSelesai} placeholder="10:00" /></View>
          </View>
          <AppInput label="Judul pertemuan" required value={topik} onChangeText={setTopik} placeholder="Contoh: Pengantar Aljabar" />
          <AppInput label="Deskripsi pertemuan" required value={deskripsi} onChangeText={setDeskripsi} placeholder="Materi atau kegiatan yang dibahas" multiline textAlignVertical="top" style={styles.descriptionInput} />
          <AppButton title={`Tambah Pertemuan ${nextNumber}`} icon="add-circle-outline" loading={creating} disabled={creating} onPress={handleCreate} />
        </View> : null}

        <FormAlert message={error} />
        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>Daftar Pertemuan</Text>
          <Text style={styles.count}>{meetings.length}</Text>
        </View>

        {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : meetings.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={28} color={colors.textFaint} />
            <Text style={styles.emptyText}>Belum ada pertemuan untuk kelas ini.</Text>
          </View>
        ) : meetings.map((meeting) => {
          const status = meetingStatus(meeting);
          const open = isAttendanceOpen(meeting);
          const roster = rosters[meeting.id];
          return (
            <View key={meeting.id} style={[styles.meetingCard, status === 'Aktif' && styles.meetingCardActive]}>
              <View style={styles.meetingTopRow}>
                <View style={styles.meetingHeading}>
                  <Text style={styles.meetingNumber}>PERTEMUAN {meeting.pertemuan_ke}</Text>
                  <View style={[styles.statusPill, status === 'Aktif' ? styles.activePill : status === 'Selesai' ? styles.donePill : styles.upcomingPill]}>
                    <Text style={[styles.statusText, status === 'Aktif' ? styles.activeText : status === 'Selesai' ? styles.doneText : styles.upcomingText]}>{status}</Text>
                  </View>
                </View>
                <View style={[styles.attendancePill, open ? styles.attendanceOpen : styles.attendanceClosed]}>
                  <Text style={[styles.attendancePillText, open ? styles.attendanceOpenText : styles.attendanceClosedText]}>{open ? 'Presensi Dibuka' : 'Presensi Ditutup'}</Text>
                </View>
              </View>
              <Text style={styles.meetingTitle}>{meeting.topik || 'Tanpa judul'}</Text>
              {meeting.deskripsi ? <Text style={styles.meetingDescription}>{meeting.deskripsi}</Text> : null}
              <View style={styles.dateLine}>
                <Ionicons name="time-outline" size={16} color={status === 'Aktif' ? colors.primary : colors.textMuted} />
                <Text style={styles.dateText}>{dateLabel(meeting.tanggal)} • {meeting.jam_mulai?.slice(0, 5) || '--:--'} – {meeting.jam_selesai?.slice(0, 5) || '--:--'} WIB</Text>
              </View>
              {editingId === meeting.id ? (
                <View style={styles.editForm}>
                  <AppInput label="Tanggal" required value={editTanggal} onChangeText={setEditTanggal} placeholder="YYYY-MM-DD" autoCapitalize="none" />
                  <View style={styles.dayPreview}>
                    <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                    <Text style={styles.dayPreviewText}>Hari: {dayForDate(editTanggal) || 'Pilih tanggal yang valid'}</Text>
                  </View>
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}><AppInput label="Jam mulai" required value={editJamMulai} onChangeText={setEditJamMulai} placeholder="08:30" /></View>
                    <View style={styles.timeField}><AppInput label="Jam selesai" required value={editJamSelesai} onChangeText={setEditJamSelesai} placeholder="10:00" /></View>
                  </View>
                  <AppInput label="Judul pertemuan" required value={editTopik} onChangeText={setEditTopik} placeholder="Judul" />
                  <AppInput label="Deskripsi pertemuan" required value={editDeskripsi} onChangeText={setEditDeskripsi} placeholder="Deskripsi" multiline textAlignVertical="top" style={styles.descriptionInput} />
                  <View style={styles.managementActions}>
                    <AppButton title="Simpan" icon="save-outline" loading={busyId === meeting.id} disabled={busyId === meeting.id} onPress={() => handleUpdate(meeting.id)} />
                    <AppButton title="Batal" variant="outline" disabled={busyId === meeting.id} onPress={() => setEditingId(null)} />
                  </View>
                </View>
              ) : (
                <View style={styles.managementActions}>
                  <Pressable style={styles.managementButton} onPress={() => beginEdit(meeting)}>
                    <Ionicons name="create-outline" size={16} color={colors.primary} /><Text style={styles.managementButtonText}>Ubah</Text>
                  </Pressable>
                  <Pressable style={[styles.managementButton, styles.deleteButton]} onPress={() => handleDelete(meeting)} disabled={busyId === meeting.id}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} /><Text style={[styles.managementButtonText, styles.deleteText]}>Hapus</Text>
                  </Pressable>
                </View>
              )}
              <View style={styles.meetingActions}>
                <Pressable style={[styles.openButton, open && styles.closeButton]} onPress={() => handleToggleOpen(meeting)} disabled={busyId === meeting.id}>
                  {busyId === meeting.id ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name={open ? 'lock-closed-outline' : 'lock-open-outline'} size={16} color="#fff" />}
                  <Text style={styles.openButtonText}>{open ? 'Tutup Presensi' : 'Buka Presensi'}</Text>
                </Pressable>
                <Pressable style={styles.rosterButton} onPress={() => toggleRoster(meeting)}>
                  <Ionicons name="people-outline" size={17} color={colors.primary} />
                  <Text style={styles.rosterButtonText}>{expandedId === meeting.id ? 'Tutup daftar' : 'Presensi siswa'}</Text>
                </Pressable>
              </View>
              {expandedId === meeting.id ? (
                <View style={styles.roster}>
                  {busyId === meeting.id && !roster ? <ActivityIndicator color={colors.primary} /> : null}
                  {roster?.length === 0 ? <Text style={styles.helperInline}>Belum ada siswa di kelas ini.</Text> : null}
                  {roster?.map((student) => (
                    <View key={student.id} style={styles.studentRow}>
                      <View style={styles.studentInfo}>
                        <Text style={styles.studentName}>{student.nama_lengkap || 'Siswa'}</Text>
                        {student.nomor_induk ? <Text style={styles.studentId}>{student.nomor_induk}</Text> : null}
                      </View>
                      <View style={styles.statusOptions}>
                        {ATTENDANCE_STATUSES.map((item) => {
                          const selected = student.attendance?.status === item.value;
                          return (
                            <Pressable key={item.value} onPress={() => handleSetStatus(meeting.id, student.id, item.value)} disabled={busyId === `${meeting.id}:${student.id}`} style={[styles.statusOption, selected && styles.statusOptionSelected]} accessibilityRole="button" accessibilityLabel={`${student.nama_lengkap}: ${item.label}`}>
                              <Text style={[styles.statusOptionText, selected && styles.statusOptionTextSelected]}>{item.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
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
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 5, marginBottom: 20 },
  formCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: 18 },
  addMeetingButton: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 48, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  addMeetingText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  nextNumber: { marginLeft: 'auto', color: colors.textMuted, fontSize: fontSize.xs },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 16 },
  formNumberBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  formNumberText: { color: colors.primary, fontWeight: fontWeight.bold },
  formHeaderText: { flex: 1 },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  helperInline: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 },
  dayPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.sm, padding: 10, marginTop: -6, marginBottom: 14 },
  dayPreviewText: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeField: { flex: 1, minWidth: 0 },
  descriptionInput: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 12 },
  count: { color: colors.textMuted, fontSize: fontSize.sm },
  loading: { marginTop: 28 },
  empty: { alignItems: 'center', gap: 10, padding: 26, backgroundColor: colors.card, borderRadius: radius.md },
  emptyText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  meetingCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: 12 },
  meetingCardActive: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  meetingTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  meetingHeading: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  meetingNumber: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.4 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill },
  activePill: { backgroundColor: colors.primarySoft },
  donePill: { backgroundColor: colors.successSoft },
  upcomingPill: { backgroundColor: colors.cardAlt },
  statusText: { fontSize: 10, fontWeight: fontWeight.bold },
  activeText: { color: colors.primary },
  doneText: { color: colors.success },
  upcomingText: { color: colors.textMuted },
  attendancePill: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: radius.pill },
  attendanceOpen: { backgroundColor: colors.successSoft },
  attendanceClosed: { backgroundColor: colors.cardAlt },
  attendancePillText: { fontSize: 9, fontWeight: fontWeight.bold },
  attendanceOpenText: { color: colors.success },
  attendanceClosedText: { color: colors.textMuted },
  meetingTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: 11 },
  meetingDescription: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20, marginTop: 6 },
  dateLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  dateText: { color: colors.textMuted, fontSize: fontSize.xs, flex: 1 },
  editForm: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  managementActions: { flexDirection: 'row', gap: 9, marginTop: 12 },
  managementButton: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  managementButtonText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  deleteButton: { backgroundColor: colors.dangerSoft },
  deleteText: { color: colors.danger },
  meetingActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  openButton: { flex: 1, minHeight: 42, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8 },
  closeButton: { backgroundColor: '#7F1D1D' },
  openButtonText: { color: '#fff', fontSize: 12, fontWeight: fontWeight.bold },
  rosterButton: { minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 11 },
  rosterButtonText: { color: colors.primary, fontSize: 12, fontWeight: fontWeight.semibold },
  roster: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 14, paddingTop: 8 },
  studentRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  studentInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  studentName: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flex: 1 },
  studentId: { color: colors.textFaint, fontSize: 11 },
  statusOptions: { flexDirection: 'row', gap: 5 },
  statusOption: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt, borderRadius: 8, paddingHorizontal: 4 },
  statusOptionSelected: { backgroundColor: colors.primary },
  statusOptionText: { color: colors.textMuted, fontSize: 10, fontWeight: fontWeight.semibold },
  statusOptionTextSelected: { color: '#fff' },
});
