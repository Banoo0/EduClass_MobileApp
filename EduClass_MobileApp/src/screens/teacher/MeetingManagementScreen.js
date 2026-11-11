import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../components/DashboardHeader';
import AppButton from '../../components/AppButton';
import AppInput from '../../components/AppInput';
import FormAlert from '../../components/FormAlert';
import { colors, fontSize, fontWeight, radius, spacing } from '../../core/theme';
import { createMeeting, deleteMeeting, fetchMeetingRoster, fetchScheduleMeetings, saveMeetingAttendance, setMeetingAttendanceOpen, updateMeeting } from '../../services/meetingService';

const ATTENDANCE_STATUSES = [
  { value: 'hadir', label: 'Hadir' },
  { value: 'izin', label: 'Izin' },
  { value: 'sakit', label: 'Sakit' },
  { value: 'alpa', label: 'Alpa' },
];

const todayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

function validDate(value) {
  const parts = value.split('-').map(Number);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || parts.length !== 3) return false;
  const parsed = new Date(parts[0], parts[1] - 1, parts[2]);
  return parsed.getFullYear() === parts[0] && parsed.getMonth() === parts[1] - 1 && parsed.getDate() === parts[2];
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

function meetingIsOpen(meeting) {
  return Boolean(
    meeting.presensi_dibuka_at &&
    new Date(meeting.presensi_dibuka_at).getTime() <= Date.now() &&
    (!meeting.presensi_ditutup_at || new Date(meeting.presensi_ditutup_at).getTime() > Date.now())
  );
}

export default function MeetingManagementScreen({ route, navigation }) {
  const { schedule, classId, className } = route.params;
  const [meetings, setMeetings] = useState([]);
  const [rosters, setRosters] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [tanggal, setTanggal] = useState(todayString());
  const [topik, setTopik] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTanggal, setEditTanggal] = useState('');
  const [editTopik, setEditTopik] = useState('');
  const [editDeskripsi, setEditDeskripsi] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const loadMeetings = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await fetchScheduleMeetings(schedule.id);
      if (result.error) throw result.error;
      setMeetings(result.data || []);
    } catch (err) {
      setError(err.message || 'Gagal memuat pertemuan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [schedule.id]);

  useFocusEffect(useCallback(() => { loadMeetings(); }, [loadMeetings]));

  const handleCreate = async () => {
    if (!validDate(tanggal)) {
      setError('Tanggal harus berformat YYYY-MM-DD.');
      return;
    }
    if (!topik.trim() || !deskripsi.trim()) {
      setError('Judul dan deskripsi pertemuan wajib diisi.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const { error: createError } = await createMeeting({ scheduleId: schedule.id, tanggal, topik, deskripsi });
      if (createError) throw createError;
      setTopik('');
      setDeskripsi('');
      await loadMeetings(true);
      notify('Pertemuan dibuat', 'Pertemuan berhasil ditambahkan ke jadwal ini.');
    } catch (err) {
      if (err.code === '23505') {
        await loadMeetings(true);
        setError('Pertemuan untuk jadwal dan tanggal tersebut sudah ada. Data yang ada dimuat di daftar.');
      } else {
        setError(err.message || 'Gagal membuat pertemuan.');
      }
    } finally {
      setCreating(false);
    }
  };

  const beginEdit = (meeting) => {
    setEditingId(meeting.id);
    setEditTanggal(meeting.tanggal);
    setEditTopik(meeting.topik || '');
    setEditDeskripsi(meeting.deskripsi || '');
    setError('');
  };

  const handleUpdate = async (meetingId) => {
    if (!validDate(editTanggal)) {
      setError('Tanggal harus berformat YYYY-MM-DD.');
      return;
    }
    if (!editTopik.trim() || !editDeskripsi.trim()) {
      setError('Judul dan deskripsi pertemuan wajib diisi.');
      return;
    }
    setBusyId(meetingId);
    setError('');
    try {
      const { data, error: saveError } = await updateMeeting({
        meetingId,
        tanggal: editTanggal,
        topik: editTopik,
        deskripsi: editDeskripsi,
      });
      if (saveError) throw saveError;
      setMeetings((previous) => previous.map((row) => row.id === meetingId ? data : row).sort((a, b) => b.tanggal.localeCompare(a.tanggal)));
      setEditingId(null);
    } catch (err) {
      setError(err.code === '23505' ? 'Pertemuan untuk jadwal dan tanggal tersebut sudah ada.' : err.message || 'Gagal mengubah pertemuan.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (meeting) => {
    confirmAction(
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
  };

  const handleToggleOpen = async (meeting) => {
    setBusyId(meeting.id);
    setError('');
    try {
      const { data, error: updateError } = await setMeetingAttendanceOpen(meeting, !meetingIsOpen(meeting));
      if (updateError) throw updateError;
      setMeetings((previous) => previous.map((row) => row.id === meeting.id ? data : row));
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
      setError(err.message || 'Gagal memuat daftar siswa dan presensi.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSetStatus = async (meetingId, studentId, status) => {
    const current = rosters[meetingId] || [];
    const student = current.find((row) => row.id === studentId);
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

  const scheduleTime = `${String(schedule.jam_mulai || '').slice(0, 5)}–${String(schedule.jam_selesai || '').slice(0, 5)}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DashboardHeader variant="guru" title="Pertemuan" onAvatarPress={() => navigation.getParent()?.navigate('Profil')} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMeetings(true)} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color={colors.primary} />
          <Text style={styles.backText}>Kembali ke kelas</Text>
        </Pressable>
        <Text style={styles.title}>{className || 'Kelas'}</Text>
        <Text style={styles.subtitle}>{schedule.hari} • {scheduleTime} • {schedule.ruang || 'Ruang belum diatur'}</Text>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Buat pertemuan</Text>
          <Text style={styles.helper}>Satu pertemuan dapat dibuat untuk setiap jadwal pada satu tanggal.</Text>
          <AppInput label="Tanggal" required value={tanggal} onChangeText={setTanggal} placeholder="YYYY-MM-DD" autoCapitalize="none" />
          <AppInput label="Judul pertemuan" required value={topik} onChangeText={setTopik} placeholder="Contoh: Persamaan linear" />
          <AppInput label="Deskripsi pertemuan" required value={deskripsi} onChangeText={setDeskripsi} placeholder="Materi atau kegiatan yang dibahas" multiline textAlignVertical="top" style={styles.descriptionInput} />
          <AppButton title="Buat Pertemuan" icon="add-circle-outline" loading={creating} disabled={creating} onPress={handleCreate} />
        </View>

        <FormAlert message={error} />
        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>Daftar pertemuan</Text>
          <Text style={styles.count}>{meetings.length}</Text>
        </View>

        {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : meetings.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={28} color={colors.textFaint} />
            <Text style={styles.emptyText}>Belum ada pertemuan untuk jadwal ini.</Text>
          </View>
        ) : meetings.map((meeting) => {
          const open = meetingIsOpen(meeting);
          const roster = rosters[meeting.id];
          return (
            <View key={meeting.id} style={styles.meetingCard}>
              <View style={styles.meetingHeader}>
                <View style={styles.meetingIcon}><Ionicons name="calendar" size={19} color={colors.primary} /></View>
                <View style={styles.meetingInfo}>
                  <Text style={styles.meetingDate}>{new Date(`${meeting.tanggal}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                  <Text style={styles.meetingTopic}>{meeting.topik || 'Tanpa topik'}</Text>
                </View>
                <View style={[styles.statusPill, open ? styles.openPill : meeting.presensi_ditutup_at ? styles.closedPill : styles.pendingPill]}>
                  <Text style={[styles.statusText, open ? styles.openText : meeting.presensi_ditutup_at ? styles.closedText : styles.pendingText]}>{open ? 'DIBUKA' : meeting.presensi_ditutup_at ? 'DITUTUP' : 'BELUM DIBUKA'}</Text>
                </View>
              </View>
              {meeting.deskripsi ? <Text style={styles.meetingDescription}>{meeting.deskripsi}</Text> : null}
              {editingId === meeting.id ? (
                <View style={styles.editForm}>
                  <AppInput label="Tanggal" required value={editTanggal} onChangeText={setEditTanggal} placeholder="YYYY-MM-DD" autoCapitalize="none" />
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
                    <Ionicons name="create-outline" size={16} color={colors.primary} />
                    <Text style={styles.managementButtonText}>Ubah</Text>
                  </Pressable>
                  <Pressable style={[styles.managementButton, styles.deleteButton]} onPress={() => handleDelete(meeting)} disabled={busyId === meeting.id}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    <Text style={[styles.managementButtonText, styles.deleteText]}>Hapus</Text>
                  </Pressable>
                </View>
              )}
              <View style={styles.meetingActions}>
                <Pressable style={[styles.openButton, open && styles.closeButton]} onPress={() => handleToggleOpen(meeting)} disabled={busyId === meeting.id}>
                  {busyId === meeting.id ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name={open ? 'lock-closed-outline' : 'lock-open-outline'} size={16} color="#fff" />}
                  <Text style={styles.openButtonText}>{open ? 'Tutup Presensi' : meeting.presensi_ditutup_at ? 'Buka Lagi' : 'Buka Presensi'}</Text>
                </Pressable>
                <Pressable style={styles.rosterButton} onPress={() => toggleRoster(meeting)}>
                  <Ionicons name="people-outline" size={17} color={colors.primary} />
                  <Text style={styles.rosterButtonText}>{expandedId === meeting.id ? 'Tutup daftar' : 'Daftar siswa'}</Text>
                </Pressable>
              </View>
              {expandedId === meeting.id ? (
                <View style={styles.roster}>
                  {busyId === meeting.id && !roster ? <ActivityIndicator color={colors.primary} /> : null}
                  {roster?.length === 0 ? <Text style={styles.helper}>Belum ada siswa di kelas ini.</Text> : null}
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
                            <Pressable
                              key={item.value}
                              onPress={() => handleSetStatus(meeting.id, student.id, item.value)}
                              disabled={busyId === `${meeting.id}:${student.id}`}
                              style={[styles.statusOption, selected && styles.statusOptionSelected]}
                              accessibilityRole="button"
                              accessibilityLabel={`${student.nama_lengkap}: ${item.label}`}
                            >
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
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  helper: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20, marginTop: 6, marginBottom: 14 },
  descriptionInput: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 12 },
  count: { color: colors.textMuted, fontSize: fontSize.sm },
  loading: { marginTop: 28 },
  empty: { alignItems: 'center', gap: 10, padding: 26, backgroundColor: colors.card, borderRadius: radius.md },
  emptyText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  meetingCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: 12 },
  meetingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meetingIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  meetingInfo: { flex: 1 },
  meetingDate: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  meetingTopic: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 3 },
  meetingDescription: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 21, marginTop: 12 },
  editForm: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  managementActions: { flexDirection: 'row', gap: 9, marginTop: 12 },
  managementButton: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  managementButtonText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  deleteButton: { backgroundColor: colors.dangerSoft },
  deleteText: { color: colors.danger },
  statusPill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill },
  openPill: { backgroundColor: colors.successSoft },
  closedPill: { backgroundColor: colors.dangerSoft },
  pendingPill: { backgroundColor: colors.cardAlt },
  statusText: { fontSize: 10, fontWeight: fontWeight.bold },
  openText: { color: colors.success },
  closedText: { color: colors.danger },
  pendingText: { color: colors.textMuted },
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
