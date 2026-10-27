
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import AppButton from '../../components/AppButton';
import AppInput from '../../components/AppInput';
import Chip from '../../components/Chip';
import EmptyState from '../../components/EmptyState';
import FormAlert from '../../components/FormAlert';

import { useAuth } from '../../context/AuthContext';

import {
  fetchTeacherClasses,
  createClass,
  updateTeacherClass,
  deleteTeacherClass,
  setClassActive,
  saveClassSchedule,
  deleteClassSchedule,
} from '../../services/classServices';

import {
  colors,
  fontSize,
  fontWeight,
  radius,
  spacing,
} from '../../core/theme';

const DAYS = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function notify(title, message) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function confirmAction(title, message, onConfirm) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Batal', style: 'cancel' },
    {
      text: 'Lanjutkan',
      style: 'destructive',
      onPress: onConfirm,
    },
  ]);
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : '--:--';
}

const defaultSchedule = {
  hari: 'Senin',
  jamMulai: '07:00',
  jamSelesai: '08:30',
  ruang: '',
  gedung: '',
};

export default function KelolaKelasScreen() {
  const { user, profile } = useAuth();
  const teacherId = user?.id || profile?.id;

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyClassId, setBusyClassId] = useState(null);
  const [busyScheduleId, setBusyScheduleId] = useState(null);
  const [error, setError] = useState('');

  // Form kelas baru.
  const [namaMapel, setNamaMapel] = useState('');
  const [rombel, setRombel] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [semester, setSemester] = useState('');
  const [hari, setHari] = useState('Senin');
  const [jamMulai, setJamMulai] = useState('07:00');
  const [jamSelesai, setJamSelesai] = useState('08:30');
  const [ruang, setRuang] = useState('');
  const [gedung, setGedung] = useState('');

  // Form edit kelas/jadwal langsung di halaman ini.
  const [editingClassId, setEditingClassId] = useState(null);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [editError, setEditError] = useState('');
  const [editNamaMapel, setEditNamaMapel] = useState('');
  const [editRombel, setEditRombel] = useState('');
  const [editTahunAjaran, setEditTahunAjaran] = useState('');
  const [editSemester, setEditSemester] = useState('');
  const [editHari, setEditHari] = useState('Senin');
  const [editJamMulai, setEditJamMulai] = useState('07:00');
  const [editJamSelesai, setEditJamSelesai] = useState('08:30');
  const [editRuang, setEditRuang] = useState('');
  const [editGedung, setEditGedung] = useState('');

  // =====================================================
  // MEMUAT KELAS DAN JADWAL
  // =====================================================

  const loadClasses = useCallback(async () => {
    if (!teacherId) {
      setClasses([]);
      setError('Akun guru tidak ditemukan. Silakan login ulang.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: requestError } =
        await fetchTeacherClasses(teacherId);

      if (requestError) {
        setError(requestError.message);
        return;
      }

      setClasses(data || []);
    } catch (err) {
      setError(err.message || 'Gagal memuat kelas.');
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useFocusEffect(
    useCallback(() => {
      loadClasses();
    }, [loadClasses])
  );

  // =====================================================
  // RESET FORM KELAS BARU
  // =====================================================

  const resetCreateForm = () => {
    setNamaMapel('');
    setRombel('');
    setTahunAjaran('');
    setSemester('');
    setHari('Senin');
    setJamMulai('07:00');
    setJamSelesai('08:30');
    setRuang('');
    setGedung('');
  };

  // =====================================================
  // MEMBUAT KELAS DAN JADWAL PERTAMA
  // =====================================================

  const handleCreateClass = async () => {
    if (!namaMapel.trim()) {
      setError('Nama mata pelajaran wajib diisi.');
      return;
    }

    if (!TIME_PATTERN.test(jamMulai) ||
        !TIME_PATTERN.test(jamSelesai) ||
        jamSelesai <= jamMulai) {
      setError('Periksa format serta urutan jam pelajaran.');
      return;
    }

    if (!teacherId) {
      setError('Akun guru tidak ditemukan.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await createClass({
        teacherId,
        nama_mapel: namaMapel,
        rombel,
        tahun_ajaran: tahunAjaran,
        semester,
        hari,
        jam_mulai: jamMulai,
        jam_selesai: jamSelesai,
        ruang,
        gedung,
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      resetCreateForm();
      await loadClasses();

      if (result.scheduleError) {
        notify(
          'Kelas berhasil dibuat',
          `Token: ${result.data.token}\n\n` +
          `Jadwal gagal disimpan: ${result.scheduleError.message}\n\n` +
          'Buka bagian Kelola Kelas pada kartu untuk melengkapi jadwal.'
        );
      } else {
        notify(
          'Kelas berhasil dibuat',
          `Token: ${result.data.token}\n\nJadwal kelas juga tersimpan.`
        );
      }
    } catch (err) {
      setError(err.message || 'Gagal membuat kelas.');
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================================
  // SALIN TOKEN
  // =====================================================

  const handleCopyToken = async (token) => {
    if (!token) {
      notify('Gagal menyalin', 'Token kelas tidak tersedia.');
      return;
    }

    try {
      await Clipboard.setStringAsync(String(token));
      notify('Token berhasil disalin', `Token: ${token}`);
    } catch (err) {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard?.writeText
      ) {
        try {
          await navigator.clipboard.writeText(String(token));
          notify('Token berhasil disalin', `Token: ${token}`);
          return;
        } catch (_) {
          // Lanjutkan ke pesan gagal.
        }
      }

      notify('Gagal menyalin token', 'Silakan coba kembali.');
    }
  };

  // =====================================================
  // BUKA FORM EDIT KELAS/JADWAL
  // schedule = null berarti menambahkan jadwal baru.
  // =====================================================

  const startEditing = (item, schedule = null) => {
    setError('');
    setEditError('');
    setEditingClassId(item.id);
    setEditingScheduleId(schedule?.id || null);

    setEditNamaMapel(item.nama_mapel || '');
    setEditRombel(item.rombel || '');
    setEditTahunAjaran(item.tahun_ajaran || '');
    setEditSemester(item.semester || '');

    setEditHari(schedule?.hari || defaultSchedule.hari);
    setEditJamMulai(
      schedule?.jam_mulai
        ? formatTime(schedule.jam_mulai)
        : defaultSchedule.jamMulai
    );
    setEditJamSelesai(
      schedule?.jam_selesai
        ? formatTime(schedule.jam_selesai)
        : defaultSchedule.jamSelesai
    );
    setEditRuang(schedule?.ruang || '');
    setEditGedung(schedule?.gedung || '');
  };

  const cancelEditing = () => {
    setEditingClassId(null);
    setEditingScheduleId(null);
    setEditError('');
  };

  // =====================================================
  // SIMPAN INFORMASI KELAS DAN JADWAL
  // Kedua operasi menggunakan tabel yang sudah ada.
  // =====================================================

  const handleSaveEdit = async () => {
    if (!editNamaMapel.trim()) {
      setEditError('Nama mata pelajaran wajib diisi.');
      return;
    }

    if (
      !TIME_PATTERN.test(editJamMulai) ||
      !TIME_PATTERN.test(editJamSelesai) ||
      editJamSelesai <= editJamMulai
    ) {
      setEditError('Periksa format serta urutan jam pelajaran.');
      return;
    }

    setSavingEdit(true);
    setEditError('');

    try {
      const classResult = await updateTeacherClass(
        editingClassId,
        teacherId,
        {
          nama_mapel: editNamaMapel,
          rombel: editRombel,
          tahun_ajaran: editTahunAjaran,
          semester: editSemester,
        }
      );

      if (classResult.error) {
        setEditError(classResult.error.message);
        return;
      }

      const scheduleResult = await saveClassSchedule({
        classId: editingClassId,
        teacherId,
        scheduleId: editingScheduleId,
        judul: editNamaMapel,
        hari: editHari,
        jam_mulai: editJamMulai,
        jam_selesai: editJamSelesai,
        ruang: editRuang,
        gedung: editGedung,
      });

      await loadClasses();

      if (scheduleResult.error) {
        setEditError(
          'Informasi kelas berhasil diperbarui, tetapi jadwal gagal disimpan: ' +
          scheduleResult.error.message
        );
        return;
      }

      cancelEditing();
      notify('Berhasil', 'Informasi kelas dan jadwal telah disimpan.');
    } catch (err) {
      setEditError(err.message || 'Gagal menyimpan perubahan.');
    } finally {
      setSavingEdit(false);
    }
  };

  // =====================================================
  // HAPUS SATU JADWAL TANPA HAPUS KELAS
  // =====================================================

  const performDeleteSchedule = async (item, schedule) => {
    setBusyScheduleId(schedule.id);
    setError('');

    try {
      const { error: deleteError } = await deleteClassSchedule(
        schedule.id,
        item.id,
        teacherId
      );

      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      if (
        editingClassId === item.id &&
        editingScheduleId === schedule.id
      ) {
        cancelEditing();
      }

      await loadClasses();
      notify('Jadwal dihapus', 'Jadwal berhasil dihapus.');
    } catch (err) {
      setError(err.message || 'Gagal menghapus jadwal.');
    } finally {
      setBusyScheduleId(null);
    }
  };

  const handleDeleteSchedule = (item, schedule) => {
    confirmAction(
      'Hapus Jadwal?',
      `Hapus jadwal ${schedule.hari}, ` +
      `${formatTime(schedule.jam_mulai)}–${formatTime(schedule.jam_selesai)}? ` +
      'Kelas dan anggota kelas tidak akan dihapus.',
      () => performDeleteSchedule(item, schedule)
    );
  };

  // =====================================================
  // HAPUS KELAS BESERTA DATA TERKAIT
  // =====================================================

  const performDeleteClass = async (item) => {
    setBusyClassId(item.id);
    setError('');

    try {
      const { error: deleteError } = await deleteTeacherClass(
        item.id,
        teacherId
      );

      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      if (editingClassId === item.id) {
        cancelEditing();
      }

      await loadClasses();
      notify('Kelas dihapus', 'Kelas berhasil dihapus.');
    } catch (err) {
      setError(err.message || 'Gagal menghapus kelas.');
    } finally {
      setBusyClassId(null);
    }
  };

  const handleDeleteClass = (item) => {
    confirmAction(
      'Hapus Kelas Permanen?',
      `Kelas "${item.nama_mapel}" akan dihapus. ` +
      'Jadwal, keanggotaan, pertemuan, dan presensi terkait ' +
      'dapat ikut terhapus karena relasi database yang sudah ada.',
      () => performDeleteClass(item)
    );
  };

  // =====================================================
  // AKTIF/NONAKTIF TOKEN
  // =====================================================

  const handleToggleActive = async (item) => {
    setBusyClassId(item.id);
    setError('');

    try {
      const { data, error: updateError } = await setClassActive(
        item.id,
        !item.aktif,
        teacherId
      );

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setClasses((previous) =>
        previous.map((kelas) =>
          kelas.id === item.id
            ? { ...kelas, ...data }
            : kelas
        )
      );
    } catch (err) {
      setError(err.message || 'Gagal mengubah status kelas.');
    } finally {
      setBusyClassId(null);
    }
  };

  // =====================================================
  // FORM EDIT, DIPAKAI DI DALAM KARTU KELAS
  // =====================================================

  const renderEditForm = (item) => (
    <View style={styles.editForm}>
      <Text style={styles.sectionTitle}>Edit Kelas</Text>

      <AppInput
        label="Nama Mata Pelajaran"
        required
        value={editNamaMapel}
        onChangeText={setEditNamaMapel}
      />

      <AppInput
        label="Rombel"
        value={editRombel}
        onChangeText={setEditRombel}
      />

      <AppInput
        label="Tahun Ajaran"
        value={editTahunAjaran}
        onChangeText={setEditTahunAjaran}
      />

      <AppInput
        label="Semester"
        value={editSemester}
        onChangeText={setEditSemester}
      />

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>
        {editingScheduleId ? 'Edit Jadwal' : 'Tambah Jadwal'}
      </Text>

      <Text style={styles.label}>Hari Pelajaran</Text>

      <View style={styles.dayGrid}>
        {DAYS.map((day) => {
          const selected = editHari === day;

          return (
            <Pressable
              key={day}
              onPress={() => setEditHari(day)}
              style={[
                styles.dayButton,
                selected && styles.daySelected,
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  selected && styles.dayTextSelected,
                ]}
              >
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <AppInput
            label="Jam Mulai"
            required
            value={editJamMulai}
            onChangeText={setEditJamMulai}
            placeholder="07:00"
          />
        </View>
        <View style={styles.timeField}>
          <AppInput
            label="Jam Selesai"
            required
            value={editJamSelesai}
            onChangeText={setEditJamSelesai}
            placeholder="08:30"
          />
        </View>
      </View>

      <AppInput
        label="Ruang"
        value={editRuang}
        onChangeText={setEditRuang}
        placeholder="Contoh: Lab Komputer"
      />

      <AppInput
        label="Gedung"
        value={editGedung}
        onChangeText={setEditGedung}
        placeholder="Contoh: Gedung A"
      />

      <FormAlert message={editError} />

      <AppButton
        title="Simpan Perubahan"
        icon="save-outline"
        loading={savingEdit}
        disabled={savingEdit}
        onPress={handleSaveEdit}
      />

      <View style={styles.secondaryButton}>
        <AppButton
          title="Batal"
          variant="outline"
          onPress={cancelEditing}
          disabled={savingEdit}
        />
      </View>
    </View>
  );

  // =====================================================
  // TAMPILAN UTAMA
  // =====================================================

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadClasses}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>RUANG BELAJAR</Text>
            <Text style={styles.title}>Kelola Kelas</Text>
            <Text style={styles.subtitle}>
              Kelola kelas dan jadwal pelajaran dalam satu halaman.
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Ionicons
              name="school-outline"
              size={28}
              color={colors.primary}
            />
          </View>
        </View>

        <FormAlert message={error} />

        {/* FORM BUAT KELAS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Buat Kelas Baru</Text>

          <AppInput
            label="Nama Mata Pelajaran"
            required
            placeholder="Contoh: Informatika"
            value={namaMapel}
            onChangeText={setNamaMapel}
          />

          <AppInput
            label="Rombel"
            placeholder="Contoh: X-3"
            value={rombel}
            onChangeText={setRombel}
          />

          <AppInput
            label="Tahun Ajaran"
            placeholder="Contoh: 2026/2027"
            value={tahunAjaran}
            onChangeText={setTahunAjaran}
          />

          <AppInput
            label="Semester"
            placeholder="Contoh: Ganjil"
            value={semester}
            onChangeText={setSemester}
          />

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Jadwal Pertama</Text>
          <Text style={styles.hint}>
            Jadwal ini akan langsung terhubung dengan kelas baru.
          </Text>

          <View style={styles.dayGrid}>
            {DAYS.map((day) => {
              const selected = hari === day;

              return (
                <Pressable
                  key={day}
                  onPress={() => setHari(day)}
                  style={[
                    styles.dayButton,
                    selected && styles.daySelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      selected && styles.dayTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <AppInput
                label="Jam Mulai"
                required
                value={jamMulai}
                onChangeText={setJamMulai}
                placeholder="07:00"
              />
            </View>
            <View style={styles.timeField}>
              <AppInput
                label="Jam Selesai"
                required
                value={jamSelesai}
                onChangeText={setJamSelesai}
                placeholder="08:30"
              />
            </View>
          </View>

          <AppInput
            label="Ruang"
            value={ruang}
            onChangeText={setRuang}
            placeholder="Contoh: Lab Komputer"
          />

          <AppInput
            label="Gedung"
            value={gedung}
            onChangeText={setGedung}
            placeholder="Contoh: Gedung A"
          />

          <AppButton
            title="Buat Kelas & Simpan Jadwal"
            icon="checkmark-circle-outline"
            loading={submitting}
            disabled={submitting || !namaMapel.trim()}
            onPress={handleCreateClass}
          />
        </View>

        {/* DAFTAR KELAS */}
        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>Kelas Saya</Text>
          <Text style={styles.hint}>{classes.length} kelas</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : classes.length === 0 ? (
          <EmptyState
            icon="school-outline"
            text="Belum ada kelas. Buat kelas pertama kamu di atas."
          />
        ) : (
          <View style={styles.classList}>
            {classes.map((item) => {
              const schedules = item.schedules || [];
              const isEditing = editingClassId === item.id;

              return (
                <View key={item.id} style={styles.classCard}>
                  <View style={styles.classHeader}>
                    <View style={styles.subjectIcon}>
                      <Ionicons
                        name="book-outline"
                        size={23}
                        color={colors.primary}
                      />
                    </View>

                    <View style={styles.classInfo}>
                      <Text style={styles.subject}>
                        {item.nama_mapel}
                      </Text>
                      <Text style={styles.meta}>
                        {[
                          item.rombel,
                          item.tahun_ajaran,
                          item.semester,
                        ].filter(Boolean).join(' • ') || 'Informasi kelas'}
                      </Text>
                    </View>

                    <Chip
                      label={item.aktif ? 'Aktif' : 'Nonaktif'}
                      tone={item.aktif ? 'success' : 'danger'}
                    />
                  </View>

                  <Text style={styles.studentCount}>
                    {item.jumlah_siswa ?? 0} siswa bergabung
                  </Text>

                  {/* DAFTAR JADWAL KELAS */}
                  <Text style={styles.scheduleHeading}>
                    Jadwal Pelajaran
                  </Text>

                  {schedules.length === 0 ? (
                    <Text style={styles.hint}>
                      Belum ada jadwal. Gunakan tombol Tambah Jadwal.
                    </Text>
                  ) : (
                    schedules.map((schedule) => (
                      <View
                        key={schedule.id}
                        style={styles.scheduleRow}
                      >
                        <View style={styles.scheduleInfo}>
                          <Text style={styles.scheduleTitle}>
                            {schedule.hari} · {formatTime(schedule.jam_mulai)}
                            {' – '}
                            {formatTime(schedule.jam_selesai)}
                          </Text>
                          <Text style={styles.meta}>
                            {[schedule.ruang, schedule.gedung]
                              .filter(Boolean)
                              .join(' • ') || 'Ruang belum diatur'}
                          </Text>
                        </View>

                        <Pressable
                          style={styles.iconButton}
                          accessibilityRole="button"
                          accessibilityLabel="Edit jadwal"
                          onPress={() => startEditing(item, schedule)}
                        >
                          <Ionicons
                            name="create-outline"
                            size={20}
                            color={colors.primary}
                          />
                        </Pressable>

                        <Pressable
                          style={styles.iconButton}
                          accessibilityRole="button"
                          accessibilityLabel="Hapus jadwal"
                          onPress={() =>
                            handleDeleteSchedule(item, schedule)
                          }
                          disabled={busyScheduleId === schedule.id}
                        >
                          {busyScheduleId === schedule.id ? (
                            <ActivityIndicator size="small" />
                          ) : (
                            <Ionicons
                              name="trash-outline"
                              size={19}
                              color={colors.danger}
                            />
                          )}
                        </Pressable>
                      </View>
                    ))
                  )}

                  {/* TOKEN */}
                  <View style={styles.tokenBox}>
                    <Text style={styles.tokenLabel}>TOKEN KELAS</Text>
                    <Text selectable style={styles.token}>
                      {item.token}
                    </Text>

                    <Pressable
                      onPress={() => handleCopyToken(item.token)}
                      style={styles.copyButton}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="copy-outline"
                        size={18}
                        color={colors.primary}
                      />
                      <Text style={styles.copyText}>Salin Token</Text>
                    </Pressable>
                  </View>

                  {/* AKSI KELAS */}
                  <AppButton
                    title={isEditing ? 'Sedang Mengedit' : 'Edit Kelas'}
                    icon="create-outline"
                    variant="outline"
                    onPress={() =>
                      startEditing(item, schedules[0] || null)
                    }
                    disabled={savingEdit}
                  />

                  <View style={styles.secondaryButton}>
                    <AppButton
                      title="Tambah Jadwal"
                      icon="add-circle-outline"
                      variant="outline"
                      onPress={() => startEditing(item, null)}
                      disabled={savingEdit}
                    />
                  </View>

                  {isEditing ? renderEditForm(item) : null}

                  <View style={styles.secondaryButton}>
                    <AppButton
                      title={item.aktif ? 'Tutup Token' : 'Buka Token'}
                      icon={
                        item.aktif
                          ? 'lock-closed-outline'
                          : 'lock-open-outline'
                      }
                      variant="outline"
                      loading={busyClassId === item.id}
                      disabled={busyClassId !== null}
                      onPress={() => handleToggleActive(item)}
                    />
                  </View>

                  <View style={styles.deleteButton}>
                    <AppButton
                      title="Hapus Kelas"
                      icon="trash-outline"
                      variant="danger"
                      loading={busyClassId === item.id}
                      disabled={busyClassId !== null || savingEdit}
                      onPress={() => handleDeleteClass(item)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const GUTTER = spacing.md + spacing.xs;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  headerText: { flex: 1 },
  eyebrow: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.heavy,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: GUTTER,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  dayButton: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
  },
  daySelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  dayText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  dayTextSelected: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  timeRow: { flexDirection: 'row', gap: spacing.md },
  timeField: { flex: 1 },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  classList: { gap: spacing.md },
  classCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: GUTTER,
    borderWidth: 1,
    borderColor: colors.border,
  },
  classHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  subjectIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classInfo: { flex: 1 },
  subject: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  studentCount: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.md,
  },
  scheduleHeading: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  scheduleInfo: { flex: 1 },
  scheduleTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenBox: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.md,
  },
  tokenLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  token: {
    color: colors.primary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.heavy,
    letterSpacing: 1.5,
    marginVertical: spacing.sm,
  },
  copyButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  copyText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  secondaryButton: { marginTop: spacing.sm },
  deleteButton: { marginTop: spacing.md },
  editForm: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
});
