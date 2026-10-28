
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import DashboardHeader from '../../components/DashboardHeader';
import AppButton from '../../components/AppButton';
import AppInput from '../../components/AppInput';
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

const DAY_ORDER = Object.fromEntries(
  DAYS.map((day, index) => [day, index])
);

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// =====================================================
// KONSTANTA WARNA
// =====================================================

const BLUE = '#4B8DFF';
const BLUE_SOFT = 'rgba(75,141,255,0.18)';

const GREEN = '#36D6A0';
const GREEN_SOFT = 'rgba(54,214,160,0.16)';

const ORANGE = '#FFB65C';
const ORANGE_SOFT = 'rgba(255,182,92,0.16)';

const RED = '#A40000';

// =====================================================
// HELPER
// =====================================================

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

function getSubjectIcon(subject = '') {
  const name = subject.toLowerCase();

  if (
    name.includes('matematika') ||
    name.includes('aljabar')
  ) {
    return 'calculator-outline';
  }

  if (
    name.includes('kimia') ||
    name.includes('fisika') ||
    name.includes('ipa')
  ) {
    return 'flask-outline';
  }

  if (
    name.includes('sejarah') ||
    name.includes('geografi') ||
    name.includes('ips')
  ) {
    return 'earth-outline';
  }

  if (
    name.includes('bahasa') ||
    name.includes('sastra')
  ) {
    return 'book-outline';
  }

  if (name.includes('informatika')) {
    return 'code-slash-outline';
  }

  return 'school-outline';
}

// Pengelompokan semester hanya untuk tampilan.
function getCurrentAcademicTerm(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();

  const academicStartYear = month >= 6 ? year : year - 1;

  const semester =
    month >= 6 && month <= 11 ? 'Ganjil' : 'Genap';

  return {
    year: `${academicStartYear}/${academicStartYear + 1}`,
    semester,
    key:
      academicStartYear * 2 +
      (semester === 'Genap' ? 1 : 0),
  };
}

function getClassTermKey(item) {
  const yearText = String(item.tahun_ajaran || '');
  const semesterText = String(item.semester || '').toLowerCase();

  const yearMatch = yearText.match(/(20\d{2})/);

  if (!yearMatch) return null;

  const startYear = Number(yearMatch[1]);

  let semesterNumber;

  if (
    semesterText.includes('ganjil') ||
    semesterText === '1'
  ) {
    semesterNumber = 0;
  } else if (
    semesterText.includes('genap') ||
    semesterText === '2'
  ) {
    semesterNumber = 1;
  } else {
    return null;
  }

  return startYear * 2 + semesterNumber;
}

function sortSchedules(schedules = []) {
  return [...schedules].sort((a, b) => {
    const dayDifference =
      (DAY_ORDER[a.hari] ?? 99) -
      (DAY_ORDER[b.hari] ?? 99);

    if (dayDifference !== 0) return dayDifference;

    return String(a.jam_mulai || '').localeCompare(
      String(b.jam_mulai || '')
    );
  });
}

function getPrimarySchedule(item) {
  return sortSchedules(item.schedules || [])[0] || null;
}

function getScheduleDescription(schedule) {
  if (!schedule) return 'Jadwal belum diatur';

  return `${schedule.hari}, ${formatTime(schedule.jam_mulai)} – ${formatTime(schedule.jam_selesai)}`;
}

function getLocation(schedule) {
  if (!schedule) return 'Belum ada lokasi';

  return [
    schedule.ruang,
    schedule.gedung,
  ].filter(Boolean).join(' • ') || 'Lokasi belum diatur';
}

// =====================================================
// KOMPONEN PILIH HARI
// =====================================================

function DayPicker({ value, onChange }) {
  return (
    <View style={styles.dayGrid}>
      {DAYS.map((day) => {
        const selected = value === day;

        return (
          <Pressable
            key={day}
            onPress={() => onChange(day)}
            style={[
              styles.dayButton,
              selected && styles.dayButtonSelected,
            ]}
          >
            <Text
              style={[
                styles.dayButtonText,
                selected && styles.dayButtonTextSelected,
              ]}
            >
              {day}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// =====================================================
// HALAMAN KELOLA KELAS
// =====================================================

export default function KelolaKelasScreen({ navigation }) {
  const { user, profile } = useAuth();
  const teacherId = user?.id || profile?.id;

  const academicTerm = getCurrentAcademicTerm();

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyClassId, setBusyClassId] = useState(null);
  const [busyScheduleId, setBusyScheduleId] = useState(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedClassId, setExpandedClassId] = useState(null);

  // Form kelas baru.
  const [namaMapel, setNamaMapel] = useState('');
  const [rombel, setRombel] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState(academicTerm.year);
  const [semester, setSemester] = useState(academicTerm.semester);

  const [hari, setHari] = useState('Senin');
  const [jamMulai, setJamMulai] = useState('07:00');
  const [jamSelesai, setJamSelesai] = useState('08:30');
  const [ruang, setRuang] = useState('');
  const [gedung, setGedung] = useState('');

  // Form edit kelas dan jadwal.
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

  // ===================================================
  // MEMUAT KELAS
  // ===================================================

  const loadClasses = useCallback(async (isRefresh = false) => {
    if (!teacherId) {
      setClasses([]);
      setError('Akun guru tidak ditemukan. Silakan login ulang.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const { data, error: requestError } =
        await fetchTeacherClasses(teacherId);

      if (requestError) {
        setError(requestError.message);
        return;
      }

      const normalized = (data || []).map((item) => ({
        ...item,
        schedules: sortSchedules(item.schedules || []),
      }));

      setClasses(normalized);
    } catch (err) {
      setError(err.message || 'Gagal memuat kelas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teacherId]);

  useFocusEffect(
    useCallback(() => {
      loadClasses();
    }, [loadClasses])
  );

  // ===================================================
  // KELOMPOK KELAS BERJALAN DAN ARSIP
  // ===================================================

  const currentClasses = classes.filter((item) => {
    const key = getClassTermKey(item);
    return key === null || key >= academicTerm.key;
  });

  const archivedClasses = classes.filter((item) => {
    const key = getClassTermKey(item);
    return key !== null && key < academicTerm.key;
  });

  // ===================================================
  // RESET FORM
  // ===================================================

  const resetCreateForm = () => {
    setNamaMapel('');
    setRombel('');
    setTahunAjaran(academicTerm.year);
    setSemester(academicTerm.semester);
    setHari('Senin');
    setJamMulai('07:00');
    setJamSelesai('08:30');
    setRuang('');
    setGedung('');
  };

  // ===================================================
  // BUAT KELAS DAN JADWAL
  // ===================================================

  const handleCreateClass = async () => {
    if (!namaMapel.trim()) {
      setError('Nama mata pelajaran wajib diisi.');
      return;
    }

    if (
      !TIME_PATTERN.test(jamMulai) ||
      !TIME_PATTERN.test(jamSelesai) ||
      jamSelesai <= jamMulai
    ) {
      setError('Periksa format dan urutan jam pelajaran.');
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
      setShowCreateForm(false);

      await loadClasses(true);

      if (result.scheduleError) {
        notify(
          'Kelas berhasil dibuat',
          `Token: ${result.data?.token || 'Tidak tersedia'}\n\n` +
          `Jadwal belum tersimpan: ${result.scheduleError.message}\n\n` +
          'Buka kartu kelas untuk melengkapi jadwal.'
        );
      } else {
        notify(
          'Kelas berhasil dibuat',
          `Token kelas: ${result.data?.token || 'Tidak tersedia'}\n\n` +
          'Kelas beserta jadwal pertamanya berhasil disimpan.'
        );
      }
    } catch (err) {
      setError(err.message || 'Gagal membuat kelas.');
    } finally {
      setSubmitting(false);
    }
  };

  // ===================================================
  // SALIN TOKEN
  // ===================================================

  const handleCopyToken = async (token) => {
    if (!token) {
      notify('Token tidak tersedia', 'Token kelas tidak ditemukan.');
      return;
    }

    try {
      await Clipboard.setStringAsync(String(token));
      notify('Token disalin', `Token kelas: ${token}`);
    } catch (err) {
      notify('Gagal menyalin token', 'Silakan coba kembali.');
    }
  };

  // ===================================================
  // BAGIKAN KELAS
  // ===================================================

  const handleShare = async (item) => {
    const message =
      `Yuk bergabung ke kelas ${item.nama_mapel}` +
      `${item.rombel ? ` ${item.rombel}` : ''} di EduClass.\n` +
      `Token kelas: ${item.token || '-'}`;

    try {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.share
      ) {
        await navigator.share({
          title: 'Bagikan Kelas EduClass',
          text: message,
        });
        return;
      }

      if (Platform.OS !== 'web') {
        await Share.share({ message });
        return;
      }

      await Clipboard.setStringAsync(message);

      notify(
        'Informasi kelas disalin',
        'Tempelkan informasi ini di tempat kamu ingin membagikannya.'
      );
    } catch (err) {
      if (err?.name !== 'AbortError') {
        notify(
          'Tidak dapat membagikan',
          'Silakan gunakan tombol Salin Token.'
        );
      }
    }
  };

  // ===================================================
  // EDIT KELAS ATAU JADWAL
  // ===================================================

  const startEditing = (item, schedule = null) => {
    setError('');
    setEditError('');

    setExpandedClassId(item.id);
    setEditingClassId(item.id);
    setEditingScheduleId(schedule?.id || null);

    setEditNamaMapel(item.nama_mapel || '');
    setEditRombel(item.rombel || '');
    setEditTahunAjaran(item.tahun_ajaran || '');
    setEditSemester(item.semester || '');

    setEditHari(schedule?.hari || 'Senin');
    setEditJamMulai(
      schedule?.jam_mulai
        ? formatTime(schedule.jam_mulai)
        : '07:00'
    );
    setEditJamSelesai(
      schedule?.jam_selesai
        ? formatTime(schedule.jam_selesai)
        : '08:30'
    );
    setEditRuang(schedule?.ruang || '');
    setEditGedung(schedule?.gedung || '');
  };

  const cancelEditing = () => {
    setEditingClassId(null);
    setEditingScheduleId(null);
    setEditError('');
  };

  // ===================================================
  // SIMPAN EDIT KELAS DAN JADWAL
  // ===================================================

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
      setEditError('Periksa format dan urutan jam pelajaran.');
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

      await loadClasses(true);

      if (scheduleResult.error) {
        setEditError(
          'Informasi kelas berhasil diperbarui, tetapi jadwal gagal disimpan: ' +
          scheduleResult.error.message
        );
        return;
      }

      cancelEditing();

      notify(
        'Perubahan tersimpan',
        'Informasi kelas dan jadwal berhasil diperbarui.'
      );
    } catch (err) {
      setEditError(err.message || 'Gagal menyimpan perubahan.');
    } finally {
      setSavingEdit(false);
    }
  };

  // ===================================================
  // HAPUS JADWAL
  // ===================================================

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

      await loadClasses(true);
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
      `Hapus jadwal ${getScheduleDescription(schedule)}?\n` +
      'Kelas dan anggota kelas tidak akan dihapus.',
      () => performDeleteSchedule(item, schedule)
    );
  };

  // ===================================================
  // HAPUS KELAS
  // ===================================================

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

      setExpandedClassId(null);
      await loadClasses(true);

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
      `Kelas "${item.nama_mapel}" akan dihapus.\n\n` +
      'Jadwal, anggota, pertemuan, dan presensi terkait dapat ikut terhapus.',
      () => performDeleteClass(item)
    );
  };

  // ===================================================
  // BUKA / TUTUP TOKEN
  // ===================================================

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
      setError(err.message || 'Gagal mengubah status token.');
    } finally {
      setBusyClassId(null);
    }
  };

  // ===================================================
  // FORM EDIT INLINE
  // ===================================================

  const renderEditForm = (item) => (
    <View style={styles.editForm}>
      <View style={styles.inlineSectionHeading}>
        <Text style={styles.inlineSectionTitle}>
          Edit Informasi Kelas
        </Text>

        <Pressable onPress={cancelEditing} hitSlop={10}>
          <Ionicons
            name="close-circle-outline"
            size={23}
            color={colors.textMuted}
          />
        </Pressable>
      </View>

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

      <Text style={styles.inlineSectionTitle}>
        {editingScheduleId ? 'Edit Jadwal' : 'Tambah Jadwal'}
      </Text>

      <Text style={styles.fieldLabel}>Hari Pelajaran</Text>

      <DayPicker value={editHari} onChange={setEditHari} />

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

      <View style={styles.formSecondaryButton}>
        <AppButton
          title="Batal"
          variant="outline"
          disabled={savingEdit}
          onPress={cancelEditing}
        />
      </View>
    </View>
  );

  // ===================================================
  // KARTU KELAS
  // ===================================================

  const renderClassCard = (item, archived = false) => {
    const schedules = sortSchedules(item.schedules || []);
    const mainSchedule = getPrimarySchedule(item);
    const expanded = expandedClassId === item.id;
    const editing = editingClassId === item.id;

    return (
      <View
        key={item.id}
        style={[
          styles.classCard,
          archived && styles.archivedCard,
        ]}
      >
        <View style={styles.classHeader}>
          <View
            style={[
              styles.subjectIcon,
              item.nama_mapel?.toLowerCase().includes('matematika')
                ? styles.mathIcon
                : item.nama_mapel?.toLowerCase().includes('sejarah')
                  ? styles.historyIcon
                  : styles.defaultSubjectIcon,
            ]}
          >
            <Ionicons
              name={getSubjectIcon(item.nama_mapel)}
              size={27}
              color={
                item.nama_mapel?.toLowerCase().includes('matematika')
                  ? '#A7C5FF'
                  : item.nama_mapel?.toLowerCase().includes('sejarah')
                    ? ORANGE
                    : '#A7C5FF'
              }
            />
          </View>

          <View style={styles.classMainInfo}>
            <Text style={styles.className} numberOfLines={2}>
              {`${item.nama_mapel || 'Mata Pelajaran'}${item.rombel ? ` ${item.rombel}` : ''}`}
            </Text>

            <View style={styles.primarySchedule}>
              <Ionicons
                name="time-outline"
                size={19}
                color={colors.textMuted}
              />

              <Text style={styles.primaryScheduleText}>
                {mainSchedule
                  ? getScheduleDescription(mainSchedule)
                  : 'Jadwal belum diatur'}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.activeBadge,
              !item.aktif && styles.inactiveBadge,
            ]}
          >
            <View
              style={[
                styles.activeDot,
                !item.aktif && styles.inactiveDot,
              ]}
            />

            <Text
              style={[
                styles.activeText,
                !item.aktif && styles.inactiveText,
              ]}
            >
              {item.aktif ? 'AKTIF' : 'NONAKTIF'}
            </Text>
          </View>
        </View>

        {/* INFORMASI SISWA DAN TOKEN */}
        <View style={styles.classMetrics}>
          <View style={styles.metricItem}>
            <Ionicons
              name="person-outline"
              size={17}
              color={colors.textMuted}
            />

            <Text style={styles.metricLabel}>Siswa</Text>

            <Text style={styles.metricValue}>
              {Number(item.jumlah_siswa || 0)}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Ionicons
              name="checkmark-circle-outline"
              size={17}
              color={colors.textMuted}
            />

            <Text style={styles.metricLabel}>Tugas Aktif</Text>

            <Text style={[styles.metricValue, styles.taskValue]}>
              —
            </Text>
          </View>

          <Pressable
            onPress={() => handleCopyToken(item.token)}
            style={styles.tokenMetric}
            accessibilityRole="button"
          >
            <Ionicons
              name="key-outline"
              size={17}
              color={colors.guru}
            />

            <Text style={styles.metricLabel}>Token</Text>

            <View style={styles.tokenValueRow}>
              <Text style={styles.tokenMetricValue} numberOfLines={1}>
                {item.token || 'Belum tersedia'}
              </Text>

              <Ionicons
                name="copy-outline"
                size={16}
                color={colors.guru}
              />
            </View>
          </Pressable>
        </View>

        {/* TOMBOL KARTU */}
        <View style={styles.cardActions}>
          <Pressable
            onPress={() =>
              setExpandedClassId(expanded ? null : item.id)
            }
            style={({ pressed }) => [
              styles.viewClassButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.viewClassText}>
              {expanded ? 'Tutup Detail' : 'Lihat Kelas'}
            </Text>

            <Ionicons
              name={expanded ? 'chevron-up' : 'arrow-forward'}
              size={20}
              color="#0D315F"
            />
          </Pressable>

          <Pressable
            onPress={() => handleShare(item)}
            style={({ pressed }) => [
              styles.shareButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons
              name="share-social-outline"
              size={19}
              color={colors.textMuted}
            />

            <Text style={styles.shareText}>Bagikan</Text>
          </Pressable>
        </View>

        {/* DETAIL KELAS */}
        {expanded ? (
          <View style={styles.expandedDetails}>
            <Text style={styles.detailHeading}>
              Informasi Kelas
            </Text>

            <DetailRow
              label="Tahun Ajaran"
              value={item.tahun_ajaran || 'Belum diatur'}
            />

            <DetailRow
              label="Semester"
              value={item.semester || 'Belum diatur'}
            />

            <DetailRow
              label="Jumlah Jadwal"
              value={`${schedules.length} sesi`}
            />

            <View style={styles.divider} />

            <View style={styles.inlineSectionHeading}>
              <Text style={styles.detailHeading}>
                Jadwal Pelajaran
              </Text>

              <Pressable
                onPress={() => startEditing(item, null)}
                style={styles.addScheduleButton}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={colors.primary}
                />

                <Text style={styles.addScheduleText}>Tambah</Text>
              </Pressable>
            </View>

            {schedules.length === 0 ? (
              <Text style={styles.emptyScheduleText}>
                Belum ada jadwal. Tekan Tambah untuk membuat jadwal pertama.
              </Text>
            ) : (
              schedules.map((schedule) => (
                <View key={schedule.id} style={styles.scheduleRow}>
                  <View style={styles.scheduleRowIcon}>
                    <Ionicons
                      name="calendar-outline"
                      size={19}
                      color={colors.primary}
                    />
                  </View>

                  <View style={styles.scheduleRowText}>
                    <Text style={styles.scheduleRowTitle}>
                      {schedule.hari}
                    </Text>

                    <Text style={styles.scheduleRowTime}>
                      {formatTime(schedule.jam_mulai)} – {formatTime(schedule.jam_selesai)}
                    </Text>

                    <Text style={styles.scheduleRowLocation}>
                      {getLocation(schedule)}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => navigation.navigate('KelolaPertemuan', {
                      schedule,
                      classId: item.id,
                      className: `${item.nama_mapel || 'Kelas'}${item.rombel ? ` ${item.rombel}` : ''}`,
                    })}
                    style={styles.scheduleAction}
                    accessibilityRole="button"
                    accessibilityLabel="Kelola pertemuan"
                  >
                    <Ionicons name="clipboard-outline" size={20} color={colors.primary} />
                  </Pressable>

                  <Pressable
                    onPress={() => startEditing(item, schedule)}
                    style={styles.scheduleAction}
                    accessibilityRole="button"
                    accessibilityLabel="Edit jadwal"
                  >
                    <Ionicons
                      name="create-outline"
                      size={20}
                      color={colors.primary}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => handleDeleteSchedule(item, schedule)}
                    style={styles.scheduleAction}
                    accessibilityRole="button"
                    accessibilityLabel="Hapus jadwal"
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

            {editing ? (
              renderEditForm(item)
            ) : (
              <View style={styles.manageActions}>
                <AppButton
                  title="Edit Kelas & Jadwal"
                  icon="create-outline"
                  onPress={() => startEditing(item, schedules[0] || null)}
                />

                <View style={styles.formSecondaryButton}>
                  <AppButton
                    title={item.aktif ? 'Tutup Pendaftaran' : 'Buka Pendaftaran'}
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

                <View style={styles.formSecondaryButton}>
                  <AppButton
                    title="Hapus Kelas"
                    icon="trash-outline"
                    variant="danger"
                    loading={busyClassId === item.id}
                    disabled={busyClassId !== null}
                    onPress={() => handleDeleteClass(item)}
                  />
                </View>
              </View>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  // ===================================================
  // TAMPILAN UTAMA
  // Kartu ringkasan dan deskripsi yang diminta sudah dihapus.
  // ===================================================

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DashboardHeader
        variant="guru"
        title="Kelola Kelas"
        onAvatarPress={() => navigation.navigate('Profil')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadClasses(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        }
      >
        <FormAlert message={error} />

        <View style={styles.pageHeading}>
          <View style={styles.pageHeadingText}>
            <Text style={styles.pageTitle}>Kelola Kelas</Text>
          </View>

          <Pressable
            onPress={() => {
              setError('');
              setShowCreateForm((value) => !value);
            }}
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons
              name={showCreateForm ? 'close' : 'add'}
              size={22}
              color="#07356F"
            />

            <Text style={styles.createButtonText}>
              {showCreateForm ? 'Tutup Form' : 'Buat Kelas'}
            </Text>
          </Pressable>
        </View>

        {/* FORM BUAT KELAS */}
        {showCreateForm ? (
          <View style={styles.createForm}>
            <View style={styles.inlineSectionHeading}>
              <Text style={styles.formHeading}>Buat Kelas Baru</Text>

              <Pressable
                onPress={() => setShowCreateForm(false)}
                hitSlop={10}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={23}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <Text style={styles.formDescription}>
              Masukkan informasi kelas dan jadwal pelajaran pertama.
              Token akan dibuat otomatis oleh database.
            </Text>

            <AppInput
              label="Nama Mata Pelajaran"
              required
              placeholder="Contoh: Matematika"
              value={namaMapel}
              onChangeText={setNamaMapel}
            />

            <AppInput
              label="Rombel"
              placeholder="Contoh: 9A"
              value={rombel}
              onChangeText={setRombel}
            />

            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <AppInput
                  label="Tahun Ajaran"
                  placeholder="2026/2027"
                  value={tahunAjaran}
                  onChangeText={setTahunAjaran}
                />
              </View>

              <View style={styles.timeField}>
                <AppInput
                  label="Semester"
                  placeholder="Ganjil / Genap"
                  value={semester}
                  onChangeText={setSemester}
                />
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.inlineSectionTitle}>
              Jadwal Pelajaran Pertama
            </Text>

            <Text style={styles.fieldLabel}>Hari</Text>

            <DayPicker value={hari} onChange={setHari} />

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
              placeholder="Contoh: Ruang 201"
              value={ruang}
              onChangeText={setRuang}
            />

            <AppInput
              label="Gedung"
              placeholder="Contoh: Gedung A"
              value={gedung}
              onChangeText={setGedung}
            />

            <AppButton
              title="Simpan Kelas & Jadwal"
              icon="checkmark-circle-outline"
              loading={submitting}
              disabled={
                submitting ||
                !namaMapel.trim() ||
                !TIME_PATTERN.test(jamMulai) ||
                !TIME_PATTERN.test(jamSelesai) ||
                jamSelesai <= jamMulai
              }
              onPress={handleCreateClass}
            />
          </View>
        ) : null}

        {/* DAFTAR KELAS: TANPA SUBTITLE TAMBAHAN */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionHeading}>
              Semester {academicTerm.semester} {academicTerm.year}
            </Text>
          </View>

          <View style={styles.runningBadge}>
            <View style={styles.runningDot} />

            <Text style={styles.runningBadgeText}>
              {currentClasses.length} Kelas Berjalan
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Memuat daftar kelas...</Text>
          </View>
        ) : currentClasses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="school-outline"
              size={32}
              color={colors.textMuted}
            />

            <Text style={styles.emptyTitle}>Belum Ada Kelas</Text>

            <Text style={styles.emptyDescription}>
              Tekan Buat Kelas untuk menambahkan kelas dan jadwal pertama.
            </Text>
          </View>
        ) : (
          <View style={styles.classList}>
            {currentClasses.map((item) => renderClassCard(item))}
          </View>
        )}

        {/* ARSIP: TANPA DESKRIPSI TAMBAHAN */}
        <View style={styles.archiveHeading}>
          <View style={styles.archiveHeadingText}>
            <Text style={styles.archiveTitle}>
              Arsip Kelas Terdahulu
            </Text>
          </View>

          <View style={styles.archiveCount}>
            <Text style={styles.archiveCountText}>
              {archivedClasses.length} Kelas
            </Text>
          </View>
        </View>

        {archivedClasses.length > 0 ? (
          <View style={styles.classList}>
            {archivedClasses.map((item) =>
              renderClassCard(item, true)
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// =====================================================
// KOMPONEN DETAIL
// =====================================================

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// =====================================================
// STYLE
// =====================================================

const GUTTER = spacing.md + spacing.xs;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  content: {
    paddingHorizontal: GUTTER,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },

  pageHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },

  pageHeadingText: {
    flex: 1,
  },

  pageTitle: {
    color: colors.text,
    fontSize: fontSize.xxl + 4,
    fontWeight: fontWeight.heavy,
  },

  createButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: BLUE,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },

  createButtonText: {
    color: '#07356F',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },

  buttonPressed: {
    opacity: 0.78,
  },

  // FORM
  createForm: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: GUTTER,
    marginBottom: spacing.xl,
  },

  formHeading: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },

  formDescription: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 21,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },

  inlineSectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  inlineSectionTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },

  fieldLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },

  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },

  dayButton: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 9,
  },

  dayButtonSelected: {
    backgroundColor: BLUE_SOFT,
    borderColor: BLUE,
  },

  dayButtonText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  dayButtonTextSelected: {
    color: colors.guru,
    fontWeight: fontWeight.bold,
  },

  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  timeField: {
    flex: 1,
    minWidth: 0,
  },

  formSecondaryButton: {
    marginTop: spacing.sm,
  },

  // HEADING DAFTAR KELAS
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },

  sectionHeaderText: {
    flex: 1,
  },

  sectionHeading: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },

  runningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: GREEN_SOFT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },

  runningDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: GREEN,
  },

  runningBadgeText: {
    color: GREEN,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },

  // KARTU KELAS
  classList: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },

  classCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: GUTTER,
    overflow: 'hidden',
  },

  archivedCard: {
    opacity: 0.9,
  },

  classHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },

  subjectIcon: {
    width: 57,
    height: 62,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mathIcon: {
    backgroundColor: 'rgba(75,141,255,0.18)',
  },

  historyIcon: {
    backgroundColor: 'rgba(255,182,92,0.16)',
  },

  defaultSubjectIcon: {
    backgroundColor: colors.cardAlt,
  },

  classMainInfo: {
    flex: 1,
    minWidth: 0,
  },

  className: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    lineHeight: 25,
  },

  primarySchedule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },

  primaryScheduleText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },

  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: GREEN_SOFT,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },

  inactiveBadge: {
    backgroundColor: colors.cardAlt,
  },

  activeDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: GREEN,
  },

  inactiveDot: {
    backgroundColor: colors.textMuted,
  },

  activeText: {
    color: GREEN,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },

  inactiveText: {
    color: colors.textMuted,
  },

  // INFORMASI PADA KARTU
  classMetrics: {
    flexDirection: 'row',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },

  metricItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },

  metricLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },

  metricValue: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },

  taskValue: {
    color: ORANGE,
  },

  tokenMetric: {
    flex: 1.3,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },

  tokenValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    maxWidth: '100%',
  },

  tokenMetricValue: {
    color: colors.guru,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    flexShrink: 1,
  },

  // TOMBOL KARTU
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },

  viewClassButton: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#ADC7FF',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },

  viewClassText: {
    color: '#0D315F',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },

  shareButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },

  shareText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },

  // DETAIL KELAS
  expandedDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },

  detailHeading: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },

  detailLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },

  detailValue: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textAlign: 'right',
  },

  addScheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: BLUE_SOFT,
  },

  addScheduleText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },

  emptyScheduleText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 21,
    marginBottom: spacing.md,
  },

  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },

  scheduleRowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: BLUE_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scheduleRowText: {
    flex: 1,
    minWidth: 0,
  },

  scheduleRowTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },

  scheduleRowTime: {
    color: colors.guru,
    fontSize: fontSize.sm,
    marginTop: 3,
  },

  scheduleRowLocation: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 18,
    marginTop: 3,
  },

  scheduleAction: {
    width: 34,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  manageActions: {
    marginTop: spacing.md,
  },

  editForm: {
    marginTop: spacing.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },

  // ARSIP
  archiveHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },

  archiveHeadingText: {
    flex: 1,
  },

  archiveTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },

  archiveCount: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  archiveCountText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },

  // LOADING DAN KOSONG
  loading: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },

  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },

  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginTop: spacing.md,
  },

  emptyDescription: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
