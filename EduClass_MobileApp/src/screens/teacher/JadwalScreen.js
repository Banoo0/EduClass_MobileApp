
import { useCallback, useState } from 'react';
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

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  if (selectedDay !== today) return 'Terjadwal';

  const start = toMinutes(schedule.jam_mulai);
  const end = toMinutes(schedule.jam_selesai);

  if (nowMinutes >= start && nowMinutes < end) {
    return 'Sedang Berlangsung';
  }

  if (nowMinutes < start) return 'Mendatang';

  return 'Selesai';
}

function getRelationClass(schedule) {
  if (Array.isArray(schedule.classes)) {
    return schedule.classes[0] || null;
  }

  return schedule.classes || null;
}

export default function JadwalScreen() {
  const { user, profile } = useAuth();
  const teacherId = user?.id || profile?.id;

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const today = DAY_BY_JS[new Date().getDay()];
  const [selectedDay, setSelectedDay] = useState(
    DAY_BY_JS[new Date().getDay()]
  );

  const [editingSchedule, setEditingSchedule] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [editHari, setEditHari] = useState('Senin');
  const [editJamMulai, setEditJamMulai] = useState('07:00');
  const [editJamSelesai, setEditJamSelesai] = useState('08:30');
  const [editRuang, setEditRuang] = useState('');
  const [editGedung, setEditGedung] = useState('');

  // ================================================
  // BACA JADWAL GURU
  // ================================================

  const loadSchedules = useCallback(async (isRefresh = false) => {
    if (!teacherId) {
      setSchedules([]);
      setError('Akun guru tidak ditemukan. Silakan login ulang.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

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
          (DAY_ORDER[a.hari] ?? 99) - (DAY_ORDER[b.hari] ?? 99);

        if (dayDifference !== 0) return dayDifference;

        return String(a.jam_mulai).localeCompare(
          String(b.jam_mulai)
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

  // ================================================
  // BUKA FORM EDIT JADWAL
  // ================================================

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
    setEditingSchedule(null);
    setEditError('');
  };

  // ================================================
  // SIMPAN PERUBAHAN JADWAL
  // ================================================

  const handleSaveEdit = async () => {
    if (!editingSchedule) return;

    if (
      !TIME_PATTERN.test(editJamMulai) ||
      !TIME_PATTERN.test(editJamSelesai) ||
      editJamSelesai <= editJamMulai
    ) {
      setEditError('Periksa format dan urutan jam pelajaran.');
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
          judul: editingSchedule.judul || kelas?.nama_mapel,
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

      // Perbarui data lokal sambil mempertahankan relasi kelas.
      setSchedules((previous) =>
        previous.map((item) =>
          item.id === data.id
            ? { ...item, ...data, classes: item.classes }
            : item
        )
      );

      closeEdit();
    } catch (err) {
      setEditError(err.message || 'Gagal menyimpan jadwal.');
    } finally {
      setSaving(false);
    }
  };

  // ================================================
  // STATUS WAKTU
  // ================================================

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const dateLabel = now.toLocaleDateString('id-ID', {
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
      String(a.jam_mulai).localeCompare(String(b.jam_mulai))
    );

  const activeCount = todaysSchedules.filter((item) =>
    getStatus(item, today, today, nowMinutes) === 'Sedang Berlangsung'
  ).length;

  const completedCount = todaysSchedules.filter((item) =>
    getStatus(item, today, today, nowMinutes) === 'Selesai'
  ).length;

  const upcomingCount = todaysSchedules.filter((item) =>
    getStatus(item, today, today, nowMinutes) === 'Mendatang'
  ).length;

  // ================================================
  // TAMPILAN
  // ================================================

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
        {/* TAB HARI */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayTabs}
        >
          {DAYS.map((day) => {
            const selected = selectedDay === day;
            const isToday = today === day;

            return (
              <Pressable
                key={day}
                onPress={() => setSelectedDay(day)}
                style={[
                  styles.dayTab,
                  selected && styles.dayTabSelected,
                  isToday && !selected && styles.dayTabToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayTabText,
                    selected && styles.dayTabTextSelected,
                  ]}
                >
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* HEADER HARI */}
        <View style={styles.heading}>
          <Text style={styles.headingTitle}>
            {selectedDay === today
              ? 'Jadwal Mengajar Hari Ini'
              : `Jadwal Mengajar Hari ${selectedDay}`}
          </Text>

          <Text style={styles.dateText}>
            {selectedDay === today
              ? `${today}, ${dateLabel}`
              : `Jadwal mingguan • ${selectedDay}`}
          </Text>
        </View>

        {selectedDay === today && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryText}>
                {todaysSchedules.length} Sesi Hari Ini
              </Text>
            </View>
          </View>
        )}

        <FormAlert message={error} />

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />
            <Text style={styles.emptyText}>
              Memuat jadwal mengajar...
            </Text>
          </View>
        ) : daySchedules.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="calendar-clear-outline"
              size={34}
              color={colors.textMuted}
            />

            <Text style={styles.emptyTitle}>
              Belum ada jadwal
            </Text>

            <Text style={styles.emptyText}>
              Belum ada jadwal pada hari {selectedDay}. Kamu dapat
              menambahkan atau mengatur jadwal melalui halaman
              Kelola Kelas.
            </Text>
          </View>
        ) : (
          <View style={styles.scheduleList}>
            {daySchedules.map((item, index) => {
              const kelas = getRelationClass(item);

              const subject =
                kelas?.nama_mapel ||
                item.judul ||
                'Jadwal Mengajar';

              const classMeta = [
                kelas?.rombel,
                kelas?.tahun_ajaran,
              ].filter(Boolean).join(' • ');

              const location = [
                item.ruang,
                item.gedung,
              ].filter(Boolean).join(' • ');

              const status = getStatus(
                item,
                selectedDay,
                today,
                nowMinutes
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
                          {formatTime(item.jam_mulai)} – {formatTime(item.jam_selesai)}
                        </Text>
                        <Text style={styles.durationText}>
                          {Math.max(
                            0,
                            toMinutes(item.jam_selesai) -
                              toMinutes(item.jam_mulai)
                          )} menit
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.subject}>{subject}</Text>

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
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* RINGKASAN HARI INI */}
        {selectedDay === today && todaysSchedules.length > 0 && (
          <View style={styles.daySummary}>
            <Text style={styles.summaryHeading}>
              Ringkasan Hari Ini
            </Text>

            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {activeCount}
                </Text>
                <Text style={styles.statLabel}>Berlangsung</Text>
              </View>

              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {upcomingCount}
                </Text>
                <Text style={styles.statLabel}>Mendatang</Text>
              </View>

              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {completedCount}
                </Text>
                <Text style={styles.statLabel}>Selesai</Text>
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
          <SafeAreaView style={styles.modalSafe}>
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
                    {getRelationClass(editingSchedule || {})?.nama_mapel ||
                      editingSchedule?.judul ||
                      'Jadwal pelajaran'}
                  </Text>
                </View>

                <Pressable
                  onPress={closeEdit}
                  style={styles.closeButton}
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
    </SafeAreaView>
  );
}

const GUTTER = spacing.md + spacing.xs;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  dayTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  dayTab: {
    minWidth: 53,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayTabSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  dayTabToday: {
    borderColor: colors.primary,
  },
  dayTabText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  dayTabTextSelected: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
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
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  summaryText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
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
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginTop: spacing.md,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: spacing.sm,
  },
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
    backgroundColor: colors.success || colors.primary,
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
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.cardAlt,
    flexShrink: 1,
  },
  statusLive: {
    backgroundColor: colors.primarySoft,
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
    backgroundColor: colors.primary,
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
    flexDirection: 'row',
  },
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
});
