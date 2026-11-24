import { FloatingSafeAreaView } from '../../components/FloatingTabBar';
import { useAppTheme } from '../../context/ThemeContext';
import AppBackdrop from '../../components/AppBackdrop';
import MonthlyCalendar from '../../components/MonthlyCalendar';

import { useCallback, useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
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

import DashboardHeader from '../../components/DashboardHeader';
import AppButton from '../../components/AppButton';
import AppInput from '../../components/AppInput';
import FormAlert from '../../components/FormAlert';

import { useAuth } from '../../context/AuthContext';
import {
  fetchTeacherSchedules,
  saveClassSchedule,
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

const DAY_BY_JS = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

const DAY_ORDER = Object.fromEntries(
  DAYS.map((day, index) => [day, index])
);

const DAY_GAP = Platform.OS === 'web' ? 10 : 5;
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// =====================================================
// HELPER
// =====================================================

function formatTime(value) {
  return value ? String(value).slice(0, 5) : '--:--';
}

function toMinutes(value) {
  const [hour, minute] = String(value || '00:00')
    .slice(0, 5)
    .split(':')
    .map(Number);

  return hour * 60 + minute;
}

function getStatus(schedule, selectedDay, today, nowMinutes) {
  if (selectedDay < today) return 'Selesai';
  if (selectedDay > today) return 'Terjadwal';

  const start = toMinutes(schedule.jam_mulai);
  const end = toMinutes(schedule.jam_selesai);

  if (nowMinutes >= start && nowMinutes < end) {
    return 'Sedang Berlangsung';
  }

  if (nowMinutes < start) {
    return 'Mendatang';
  }

  return 'Selesai';
}

function getRelationClass(schedule) {
  if (Array.isArray(schedule?.classes)) {
    return schedule.classes[0] || null;
  }

  return schedule?.classes || null;
}

// =====================================================
// JADWAL GURU
// =====================================================

export default function JadwalScreen({ navigation }) {
  const { colors, mode: appThemeMode } = useAppTheme();
  const styles = make_styles(colors);

  const { user, profile } = useAuth();
  const teacherId = user?.uid || user?.id || profile?.id;

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const today = DAY_BY_JS[new Date().getDay()];

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const selectedDay = DAY_BY_JS[selectedDate.getDay()];
  const selectedKey = dateKey(selectedDate);
  const todayKey = dateKey(new Date());
  const isTodaySelected = selectedKey === todayKey;

  const [editingSchedule, setEditingSchedule] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [editHari, setEditHari] = useState('Senin');
  const [editJamMulai, setEditJamMulai] = useState('07:00');
  const [editJamSelesai, setEditJamSelesai] = useState('08:30');
  const [editRuang, setEditRuang] = useState('');
  const [editGedung, setEditGedung] = useState('');

  // ===================================================
  // MEMUAT JADWAL GURU
  // ===================================================

  const loadSchedules = useCallback(async (isRefresh = false) => {
    if (!teacherId) {
      setSchedules([]);
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
        await fetchTeacherSchedules(teacherId);

      if (requestError) {
        setError(requestError.message);
        return;
      }

      const sorted = [...(data || [])].sort((a, b) => {
        const dayDifference =
          (DAY_ORDER[a.hari] ?? 99) -
          (DAY_ORDER[b.hari] ?? 99);

        if (dayDifference !== 0) {
          return dayDifference;
        }

        return String(a.jam_mulai || '').localeCompare(
          String(b.jam_mulai || '')
        );
      });

      setSchedules(sorted);
    } catch (err) {
      setError(err.message || 'Gagal memuat jadwal guru.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teacherId]);

  useFocusEffect(
    useCallback(() => {
      loadSchedules();
    }, [loadSchedules])
  );

  // ===================================================
  // MEMBUKA FORM EDIT
  // ===================================================

  const openEdit = (schedule) => {
    setEditingSchedule(schedule);
    setEditError('');

    setEditHari(schedule.hari || 'Senin');
    setEditJamMulai(formatTime(schedule.jam_mulai));
    setEditJamSelesai(formatTime(schedule.jam_selesai));
    setEditRuang(schedule.ruang || '');
    setEditGedung(schedule.gedung || '');
  };

  const closeEdit = () => {
    if (saving) return;

    setEditingSchedule(null);
    setEditError('');
  };

  // ===================================================
  // MENYIMPAN PERUBAHAN JADWAL
  // ===================================================

  const handleSaveEdit = async () => {
    if (!editingSchedule) return;

    if (
      !TIME_PATTERN.test(editJamMulai) ||
      !TIME_PATTERN.test(editJamSelesai) ||
      editJamSelesai <= editJamMulai
    ) {
      setEditError(
        'Periksa format dan urutan jam pelajaran.'
      );
      return;
    }

    if (!teacherId) {
      setEditError('Akun guru tidak ditemukan.');
      return;
    }

    setSaving(true);
    setEditError('');

    try {
      const kelas = getRelationClass(editingSchedule);

      const { data, error: saveError } =
        await saveClassSchedule({
          classId: editingSchedule.class_id,
          teacherId,
          scheduleId: editingSchedule.id,
          judul:
            editingSchedule.judul ||
            kelas?.nama_mapel,
          hari: editHari,
          jam_mulai: editJamMulai,
          jam_selesai: editJamSelesai,
          ruang: editRuang,
          gedung: editGedung,
        });

      if (saveError) {
        setEditError(saveError.message);
        return;
      }

      // Pertahankan relasi kelas ketika memperbarui data lokal.
      setSchedules((previous) =>
        previous.map((item) =>
          item.id === data.id
            ? {
                ...item,
                ...data,
                classes: item.classes,
              }
            : item
        )
      );

      setEditingSchedule(null);
      setEditError('');
    } catch (err) {
      setEditError(
        err.message || 'Gagal menyimpan jadwal.'
      );
    } finally {
      setSaving(false);
    }
  };

  // ===================================================
  // STATUS DAN RINGKASAN HARI INI
  // ===================================================

  const now = new Date();
  const nowMinutes =
    now.getHours() * 60 + now.getMinutes();

  const dateLabel = selectedDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const todaysSchedules = schedules.filter(
    (item) => item.hari === today
  );

  const daySchedules = schedules
    .filter((item) => item.hari === selectedDay)
    .sort((a, b) =>
      String(a.jam_mulai || '').localeCompare(
        String(b.jam_mulai || '')
      )
    );

  const activeCount = todaysSchedules.filter(
    (item) =>
      getStatus(item, todayKey, todayKey, nowMinutes) ===
      'Sedang Berlangsung'
  ).length;

  const completedCount = todaysSchedules.filter(
    (item) =>
      getStatus(item, todayKey, todayKey, nowMinutes) === 'Selesai'
  ).length;

  const upcomingCount = todaysSchedules.filter(
    (item) =>
      getStatus(item, todayKey, todayKey, nowMinutes) === 'Mendatang'
  ).length;

  // ===================================================
  // TAMPILAN HALAMAN
  // ===================================================

  return (
    <FloatingSafeAreaView style={styles.safe} edges={['top']}><AppBackdrop />
      {/* HEADER YANG SAMA DENGAN BERANDA GURU */}
      <DashboardHeader
        variant="guru"
        title="Jadwal"
        onAvatarPress={() => navigation.navigate('Profil')}
      />

      {/* FOOTER SUDAH DIKELOLA OLEH TEACHERTABS.JS */}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadSchedules(true)}
            tintColor={colors.primary}
          />
        }
      >
        <MonthlyCalendar selectedDateKey={selectedKey} schedules={schedules} onChange={key => { const [y,m,d]=key.split('-').map(Number); setSelectedDate(new Date(y,m-1,d)); }} />
        <View style={[styles.heading,{marginTop:20}]}>
          <Text style={styles.headingTitle}>{selectedDay}, {dateLabel}</Text>
        </View>

        <FormAlert message={error} />

        {/* LOADING DAN DAFTAR JADWAL */}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />

            
          </View>
        ) : daySchedules.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="calendar-clear-outline"
              size={24}
              color={colors.textMuted}
            />

            <Text style={styles.emptyTitle}>
              Belum ada jadwal
            </Text>

            
          </View>
        ) : (
          <View style={styles.scheduleList}>
            {daySchedules.map((item) => {
              const kelas = getRelationClass(item);

              const subject =
                kelas?.nama_mapel ||
                item.judul ||
                'Jadwal Mengajar';

              const classMeta = [
                kelas?.rombel,
                kelas?.tahun_ajaran,
              ]
                .filter(Boolean)
                .join(' • ');

              const location = [
                item.ruang,
                item.gedung,
              ]
                .filter(Boolean)
                .join(' • ');

              const status = getStatus(
                item,
                selectedKey,
                todayKey,
                nowMinutes
              );

              const duration = Math.max(
                0,
                toMinutes(item.jam_selesai) -
                  toMinutes(item.jam_mulai)
              );

              return (
                <View key={item.id} style={styles.scheduleCard}>
                  <View
                    style={[
                      styles.statusBar,
                      status === 'Sedang Berlangsung' &&
                        styles.statusBarLive,
                    ]}
                  />

                  <View style={styles.cardBody}>
                    <View style={styles.scheduleTop}>
                      <View
                        style={[
                          styles.statusBadge,
                          status === 'Sedang Berlangsung' &&
                            styles.statusLive,
                          status === 'Mendatang' &&
                            styles.statusUpcoming,
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            status === 'Sedang Berlangsung' &&
                              styles.statusDotLive,
                          ]}
                        />

                        <Text style={styles.statusText}>
                          {status}
                        </Text>
                      </View>

                      <View style={styles.timeBox}>
                        <Text style={styles.timeText}>
                          {formatTime(item.jam_mulai)} –{' '}
                          {formatTime(item.jam_selesai)}
                        </Text>

                        <Text style={styles.durationText}>
                          {duration} menit
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.subject}>
                      {subject}
                    </Text>

                    {classMeta ? (
                      <Text style={styles.classMeta}>
                        {classMeta}
                      </Text>
                    ) : null}

                    <View style={styles.locationRow}>
                      <Ionicons
                        name="location-outline"
                        size={16}
                        color={colors.textMuted}
                      />

                      <Text style={styles.locationText}>
                        {location || 'Ruang belum diatur'}
                      </Text>
                    </View>

                    <View style={styles.cardDivider} />

                    <View style={styles.cardActions}>
                      <AppButton
                        title="Edit Jadwal"
                        icon="create-outline"
                        variant="outline"
                        onPress={() => openEdit(item)}
                      />
                      <AppButton title="Buat / Kelola Pertemuan" icon="add-circle-outline" onPress={() => navigation.navigate('KelolaKelas', { screen: 'KelolaPertemuan', params: { classId: item.class_id, className: [subject,kelas?.rombel].filter(Boolean).join(' '), semester: kelas?.semester ?? null, tahunAjaran: kelas?.tahun_ajaran ?? null, jumlahSiswa: null, initialDate: selectedKey, initialStart: formatTime(item.jam_mulai), initialEnd: formatTime(item.jam_selesai) } })} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* RINGKASAN HARI INI */}
        {isTodaySelected &&
          todaysSchedules.length > 0 && (
            <View style={styles.daySummary}>
              <Text style={styles.summaryHeading}>
                Ringkasan Hari Ini
              </Text>

              <View style={styles.summaryStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {activeCount}
                  </Text>

                  <Text style={styles.statLabel}>
                    Berlangsung
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {upcomingCount}
                  </Text>

                  <Text style={styles.statLabel}>
                    Mendatang
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {completedCount}
                  </Text>

                  <Text style={styles.statLabel}>
                    Selesai
                  </Text>
                </View>
              </View>
            </View>
          )}
      </ScrollView>

      {/* MODAL EDIT JADWAL */}
      <Modal
        visible={Boolean(editingSchedule)}
        transparent
        animationType="slide"
        onRequestClose={closeEdit}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalSafe}><AppBackdrop />
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>
                    Edit Jadwal
                  </Text>

                  <Text style={styles.modalSubtitle}>
                    {getRelationClass(editingSchedule)?.nama_mapel ||
                      editingSchedule?.judul ||
                      'Jadwal pelajaran'}
                  </Text>
                </View>

                <Pressable
                  onPress={closeEdit}
                  style={styles.closeButton}
                  disabled={saving}
                >
                  <Ionicons
                    name="close"
                    size={23}
                    color={colors.text}
                  />
                </Pressable>
              </View>

              <FormAlert message={editError} />

              <Text style={styles.label}>Hari</Text>

              <View style={styles.dayGrid}>
                {DAYS.map((day) => {
                  const selected = editHari === day;

                  return (
                    <Pressable
                      key={day}
                      onPress={() => setEditHari(day)}
                      style={[
                        styles.editDayButton,
                        selected && styles.editDaySelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.editDayText,
                          selected && styles.editDayTextSelected,
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

              <AppButton
                title="Simpan Perubahan Jadwal"
                icon="save-outline"
                loading={saving}
                disabled={saving}
                onPress={handleSaveEdit}
              />

              <View style={styles.modalCancel}>
                <AppButton
                  title="Batal"
                  icon="close-outline"
                  variant="outline"
                  onPress={closeEdit}
                  disabled={saving}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </FloatingSafeAreaView>
  );
}

// =====================================================
// STYLES
// =====================================================

const GUTTER = spacing.md + spacing.xs;

const make_styles = (colors) => (StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  content: {
    paddingHorizontal: GUTTER,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },

  // PILIH HARI
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.lg,
  },

  calendarArrow: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },

  calendarStrip: {
    flex: 1,
    minWidth: 0,
  },

  dayTabs: {
    flexDirection: 'row',
    gap: DAY_GAP,
    paddingBottom: 8,
  },

  dayTab: {
    height: 90,
    flexShrink: 0,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },

  dayNumber: {
    color: colors.text,
    fontSize: 24,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },

  dayTabSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },

  dayTabToday: {
    borderColor: colors.primary,
  },

  dayTabText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },

  dayTabTextSelected: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },

  // HEADING
  heading: {
    marginBottom: spacing.sm,
  },

  headingTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },

  dateText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },

  summaryRow: {
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },

  summaryPill: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },

  summaryText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },

  // LOADING DAN KOSONG
  loading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },

  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginTop: spacing.sm,
  },

  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: spacing.sm,
  },

  // KARTU JADWAL
  scheduleList: {
    gap: spacing.md,
  },

  scheduleCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  statusBar: {
    width: 3,
    backgroundColor: colors.border,
  },

  statusBarLive: {
    backgroundColor: colors.success,
  },

  cardBody: {
    flex: 1,
    padding: spacing.md,
  },

  scheduleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.cardAlt,
    flexShrink: 1,
  },

  statusLive: {
    backgroundColor: colors.successSoft,
  },

  statusUpcoming: {
    backgroundColor: colors.cardAlt,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },

  statusDotLive: {
    backgroundColor: colors.success,
  },

  statusText: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  timeBox: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },

  timeText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },

  durationText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 3,
  },

  subject: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },

  classMeta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },

  locationText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    flex: 1,
  },

  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },

  cardActions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },

  // RINGKASAN HARI INI
  daySummary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.xl,
  },

  summaryHeading: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },

  summaryStats: {
    flexDirection: 'row',
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
  },

  statNumber: {
    color: colors.primary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.heavy,
  },

  statLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // MODAL EDIT
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  modalSafe: {
    maxHeight: '92%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },

  modalContent: {
    padding: GUTTER,
    paddingBottom: spacing.xl,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },

  modalHeaderText: {
    flex: 1,
  },

  modalTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },

  modalSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
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

  editDayButton: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },

  editDaySelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },

  editDayText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },

  editDayTextSelected: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },

  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  timeField: {
    flex: 1,
  },

  modalCancel: {
    marginTop: spacing.sm,
  },
}));
