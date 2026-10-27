
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import FormAlert from '../../components/FormAlert';

import { useAuth } from '../../context/AuthContext';
import { fetchStudentSchedules } from '../../services/classServices';
import { supabase } from '../../core/supabase';

import {
  colors,
  fontSize,
  fontWeight,
  radius,
  spacing,
} from '../../core/theme';

const RED = '#A40000';
const RED_DARK = '#860000';
const GREEN = '#36D6A0';
const BLUE = '#3B82F6';

const DAYS = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
];

const DAY_SHORT = {
  Senin: 'Sen',
  Selasa: 'Sel',
  Rabu: 'Rab',
  Kamis: 'Kam',
  Jumat: 'Jum',
  Sabtu: 'Sab',
  Minggu: 'Min',
};

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

// =====================================================
// HELPER TANGGAL DAN JAM
// =====================================================

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function startOfWeek(date) {
  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const dayIndex = (result.getDay() + 6) % 7;

  result.setDate(result.getDate() - dayIndex);

  return result;
}

function getWeekDates(date) {
  const monday = startOfWeek(date);

  return DAYS.map((_, index) => {
    const result = new Date(monday);

    result.setDate(monday.getDate() + index);

    return result;
  });
}

function formatDate(date, options = {}) {
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    ...options,
  });
}

function formatLongDate(date) {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(value) {
  if (!value) return '--.--';

  return String(value).slice(0, 5).replace(':', '.');
}

function toMinutes(value) {
  const [hour, minute] = String(value || '00:00')
    .slice(0, 5)
    .split(':')
    .map(Number);

  return hour * 60 + minute;
}

function durationMinutes(schedule) {
  return Math.max(
    0,
    toMinutes(schedule.jam_selesai) -
      toMinutes(schedule.jam_mulai)
  );
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (hours === 0) return `${remaining} menit`;
  if (remaining === 0) return `${hours} jam`;

  return `${hours} jam ${remaining} menit`;
}

function normalizeDay(value) {
  return String(value || '').trim().toLowerCase();
}

function getScheduleStatus(schedule, selectedDateKey, todayKey, nowMinutes) {
  if (selectedDateKey < todayKey) {
    return 'Selesai';
  }

  if (selectedDateKey > todayKey) {
    return 'Mendatang';
  }

  const start = toMinutes(schedule.jam_mulai);
  const end = toMinutes(schedule.jam_selesai);

  if (nowMinutes < start) return 'Mendatang';
  if (nowMinutes >= end) return 'Selesai';

  return 'Sedang Berlangsung';
}

function getClassRelation(schedule) {
  if (Array.isArray(schedule.classes)) {
    return schedule.classes[0] || null;
  }

  return schedule.classes || null;
}

function getSubject(schedule) {
  const kelas = getClassRelation(schedule);

  return kelas?.nama_mapel || schedule.judul || 'Mata Pelajaran';
}

function getRoomText(schedule) {
  const parts = [
    schedule.ruang,
    schedule.gedung,
  ].filter(Boolean);

  return parts.join(' • ') || 'Lokasi belum diatur';
}

function getWeekNumber(date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDayOffset = (firstDay.getDay() + 6) % 7;

  return Math.ceil((date.getDate() + firstDayOffset) / 7);
}

function getStatusStyle(status) {
  if (status === 'Sedang Berlangsung') {
    return {
      badge: styles.statusLive,
      dot: styles.statusDotLive,
      text: styles.statusTextLive,
    };
  }

  if (status === 'Selesai') {
    return {
      badge: styles.statusDone,
      dot: styles.statusDotDone,
      text: styles.statusTextDone,
    };
  }

  return {
    badge: styles.statusUpcoming,
    dot: styles.statusDotUpcoming,
    text: styles.statusTextUpcoming,
  };
}

function notify(title, message) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// =====================================================
// JADWAL SISWA
// =====================================================

export default function JadwalScreen({ navigation }) {
  const { user, profile } = useAuth();
  const studentId = user?.id || profile?.id;

  const [schedules, setSchedules] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [teacherMap, setTeacherMap] = useState({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceBusyId, setAttendanceBusyId] = useState(null);
  const [error, setError] = useState('');

  const [selectedDateKey, setSelectedDateKey] = useState(
    toDateKey(new Date())
  );

  // Tanggal minggu berjalan dihitung berdasarkan tanggal perangkat.
  const now = new Date();
  const todayKey = toDateKey(now);
  const today = DAY_BY_JS[now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const weekDates = getWeekDates(now);
  const weekStartKey = toDateKey(weekDates[0]);
  const weekEndKey = toDateKey(weekDates[6]);

  const selectedDate = parseDateKey(selectedDateKey);
  const selectedDay = DAY_BY_JS[selectedDate.getDay()];

  // ===================================================
  // MEMUAT JADWAL DARI DATABASE YANG SUDAH ADA
  // ===================================================

  const loadSchedules = useCallback(async (isRefresh = false) => {
    if (!studentId) {
      setSchedules([]);
      setMeetings([]);
      setAttendanceMap({});
      setTeacherMap({});
      setError('Akun siswa tidak ditemukan. Silakan login ulang.');
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
      const { data, error: scheduleError } =
        await fetchStudentSchedules(studentId);

      if (scheduleError) {
        setError(scheduleError.message);
        setSchedules([]);
        return;
      }

      const rows = [...(data || [])].sort((a, b) => {
        const dayDifference =
          (DAY_ORDER[a.hari] ?? 99) -
          (DAY_ORDER[b.hari] ?? 99);

        if (dayDifference !== 0) return dayDifference;

        return String(a.jam_mulai || '').localeCompare(
          String(b.jam_mulai || '')
        );
      });

      setSchedules(rows);

      // Nama guru bersifat data tambahan.
      // Jika RLS membatasi pembacaan profiles, jadwal tetap tampil.
      const teacherIds = [
        ...new Set(rows.map((item) => item.teacher_id).filter(Boolean)),
      ];

      let nextTeacherMap = {};

      if (teacherIds.length > 0) {
        const { data: teachers, error: teacherError } =
          await supabase
            .from('profiles')
            .select('id, nama_lengkap')
            .in('id', teacherIds);

        if (!teacherError && teachers) {
          nextTeacherMap = Object.fromEntries(
            teachers.map((item) => [
              item.id,
              item.nama_lengkap,
            ])
          );
        }
      }

      setTeacherMap(nextTeacherMap);

      // Pertemuan dan presensi berasal dari tabel yang sudah ada.
      // Kegagalan membaca keduanya tidak menghilangkan jadwal pelajaran.
      const scheduleIds = rows.map((item) => item.id).filter(Boolean);

      let nextMeetings = [];
      let nextAttendanceMap = {};

      if (scheduleIds.length > 0) {
        const { data: meetingRows, error: meetingError } =
          await supabase
            .from('meetings')
            .select(`
              id,
              schedule_id,
              tanggal,
              topik,
              presensi_dibuka_at,
              presensi_ditutup_at
            `)
            .in('schedule_id', scheduleIds)
            .gte('tanggal', weekStartKey)
            .lte('tanggal', weekEndKey);

        if (!meetingError && meetingRows) {
          nextMeetings = meetingRows;

          const meetingIds = meetingRows
            .map((item) => item.id)
            .filter(Boolean);

          if (meetingIds.length > 0) {
            const { data: attendanceRows, error: attendanceError } =
              await supabase
                .from('attendances')
                .select('id, meeting_id, status')
                .eq('student_id', studentId)
                .in('meeting_id', meetingIds);

            if (!attendanceError && attendanceRows) {
              nextAttendanceMap = Object.fromEntries(
                attendanceRows.map((item) => [
                  item.meeting_id,
                  item,
                ])
              );
            }
          }
        }
      }

      setMeetings(nextMeetings);
      setAttendanceMap(nextAttendanceMap);
    } catch (err) {
      setError(err.message || 'Gagal memuat jadwal pelajaran.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studentId, weekStartKey, weekEndKey]);

  useFocusEffect(
    useCallback(() => {
      loadSchedules();
    }, [loadSchedules])
  );

  // ===================================================
  // DATA UNTUK KARTU DAN RINGKASAN
  // ===================================================

  const todaySchedules = schedules.filter(
    (item) => normalizeDay(item.hari) === normalizeDay(today)
  );

  const selectedSchedules = schedules
    .filter(
      (item) => normalizeDay(item.hari) === normalizeDay(selectedDay)
    )
    .sort((a, b) =>
      String(a.jam_mulai || '').localeCompare(
        String(b.jam_mulai || '')
      )
    );

  const totalDuration = schedules.reduce(
    (total, item) => total + durationMinutes(item),
    0
  );

  const todayActiveCount = todaySchedules.filter(
    (item) =>
      getScheduleStatus(item, todayKey, todayKey, nowMinutes) ===
      'Sedang Berlangsung'
  ).length;

  const monthLabel = now.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  const weekNumber = getWeekNumber(now);

  // ===================================================
  // PRESENSI MENGGUNAKAN MEETINGS DAN ATTENDANCES
  // ===================================================

  const handleAttendance = async (schedule) => {
    if (!studentId) {
      notify('Tidak bisa presensi', 'Akun siswa tidak ditemukan.');
      return;
    }

    if (selectedDateKey !== todayKey) {
      notify(
        'Presensi belum tersedia',
        'Presensi hanya dapat dilakukan pada tanggal pertemuan hari ini.'
      );
      return;
    }

    const meeting = meetings.find(
      (item) =>
        item.schedule_id === schedule.id &&
        item.tanggal === selectedDateKey
    );

    if (!meeting) {
      notify(
        'Belum ada sesi presensi',
        'Guru belum membuat pertemuan untuk jadwal dan tanggal ini.'
      );
      return;
    }

    if (attendanceMap[meeting.id]) {
      notify(
        'Presensi sudah tercatat',
        `Status: ${attendanceMap[meeting.id].status || 'hadir'}`
      );
      return;
    }

    const currentTimestamp = Date.now();

    if (
      !meeting.presensi_dibuka_at ||
      currentTimestamp < new Date(meeting.presensi_dibuka_at).getTime()
    ) {
      notify(
        'Presensi belum dibuka',
        'Tunggu sampai guru membuka presensi.'
      );
      return;
    }

    if (
      meeting.presensi_ditutup_at &&
      currentTimestamp > new Date(meeting.presensi_ditutup_at).getTime()
    ) {
      notify(
        'Presensi sudah ditutup',
        'Waktu presensi pertemuan ini sudah berakhir.'
      );
      return;
    }

    setAttendanceBusyId(schedule.id);

    try {
      const { data, error: insertError } = await supabase
        .from('attendances')
        .insert({
          meeting_id: meeting.id,
          student_id: studentId,
          status: 'hadir',
        })
        .select('id, meeting_id, status')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          notify(
            'Presensi sudah tercatat',
            'Akun ini sudah memiliki presensi pada pertemuan tersebut.'
          );

          await loadSchedules(true);
          return;
        }

        notify(
          'Presensi gagal',
          insertError.message ||
            'Periksa izin presensi atau coba kembali.'
        );
        return;
      }

      setAttendanceMap((previous) => ({
        ...previous,
        [meeting.id]: data,
      }));

      notify(
        'Presensi berhasil',
        'Kehadiran kamu sudah disimpan.'
      );
    } catch (err) {
      notify('Presensi gagal', err.message || 'Silakan coba kembali.');
    } finally {
      setAttendanceBusyId(null);
    }
  };

  // ===================================================
  // MASUK ONLINE
  // ===================================================

  const handleOpenOnline = async (schedule) => {
    const meetingUrl = schedule.meeting_url;

    if (!meetingUrl) {
      notify(
        'Tautan belum tersedia',
        'Guru belum menambahkan tautan pertemuan online pada jadwal ini.'
      );
      return;
    }

    try {
      await Linking.openURL(meetingUrl);
    } catch (err) {
      notify(
        'Tidak dapat membuka tautan',
        err.message || 'Periksa tautan pertemuan.'
      );
    }
  };

  // ===================================================
  // HEADER DAN TAMPILAN UTAMA
  // ===================================================

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DashboardHeader
        variant="siswa"
        title="Beranda"
        onAvatarPress={() => navigation.navigate('Profil')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadSchedules(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        }
      >
        <FormAlert message={error} />

        {/* JUDUL JADWAL */}
        <View style={styles.pageHeading}>
          <View style={styles.pageTitleWrap}>
            <Text style={styles.pageTitle}>Jadwal Pelajaran</Text>
            <Text style={styles.pageSubtitle}>
              Minggu Ini • {monthLabel}
            </Text>
          </View>

          <View style={styles.weekBadge}>
            <Ionicons
              name="calendar"
              size={15}
              color="#A7C5FF"
            />
            <Text style={styles.weekBadgeText}>
              Pekan {weekNumber}
            </Text>
          </View>
        </View>

        {/* RINGKASAN */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <Text style={styles.statLabel}>Hari Ini</Text>
              <View style={styles.statIconBlue}>
                <Ionicons
                  name="book"
                  size={16}
                  color="#A7C5FF"
                />
              </View>
            </View>

            <View style={styles.statValueRow}>
              <Text style={[styles.statNumber, { color: '#A7C5FF' }]}>
                {todaySchedules.length}
              </Text>
              <Text style={styles.statUnit}>Mapel</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <Text style={styles.statLabel}>Minggu Ini</Text>
              <View style={styles.statIconGreen}>
                <Ionicons
                  name="calendar"
                  size={16}
                  color={GREEN}
                />
              </View>
            </View>

            <View style={styles.statValueRow}>
              <Text style={[styles.statNumber, { color: GREEN }]}>
                {schedules.length}
              </Text>
              <Text style={styles.statUnit}>Sesi</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <Text style={styles.statLabel}>Durasi</Text>
              <View style={styles.statIconOrange}>
                <Ionicons
                  name="time"
                  size={16}
                  color="#FFB65C"
                />
              </View>
            </View>

            <View style={styles.statValueRow}>
              <Text style={[styles.statNumber, { color: '#FFB65C' }]}>
                {Math.round(totalDuration / 60)}
              </Text>
              <Text style={styles.statUnit}>Jam</Text>
            </View>
          </View>
        </View>

        {/* PILIH TANGGAL MINGGU INI */}
        <View style={styles.calendarSection}>
          <View style={styles.calendarHeading}>
            <Text style={styles.sectionTitle}>PILIH HARI</Text>

            <View style={styles.calendarDatePill}>
              <View style={styles.todayDot} />
              <Text style={styles.calendarDateText} numberOfLines={1}>
                {DAY_BY_JS[parseDateKey(selectedDateKey).getDay()]},
                {' '}
                {formatDate(parseDateKey(selectedDateKey))}
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateList}
          >
            {weekDates.map((date) => {
              const dateKey = toDateKey(date);
              const day = DAY_BY_JS[date.getDay()];
              const selected = dateKey === selectedDateKey;
              const isToday = dateKey === todayKey;

              return (
                <Pressable
                  key={dateKey}
                  onPress={() => setSelectedDateKey(dateKey)}
                  style={[
                    styles.dateCard,
                    selected && styles.dateCardSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dateDay,
                      selected && styles.dateTextSelected,
                    ]}
                  >
                    {DAY_SHORT[day]}
                  </Text>

                  <Text
                    style={[
                      styles.dateNumber,
                      selected && styles.dateTextSelected,
                    ]}
                  >
                    {date.getDate()}
                  </Text>

                  {isToday ? (
                    <View
                      style={[
                        styles.dateIndicator,
                        selected && styles.dateIndicatorSelected,
                      ]}
                    />
                  ) : (
                    <View style={styles.dateIndicatorPlaceholder} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* JUDUL DAFTAR SESI */}
        <View style={styles.scheduleHeading}>
          <View style={styles.scheduleHeadingLeft}>
            <Text style={styles.scheduleHeadingTitle}>
              {selectedDateKey === todayKey
                ? 'Jadwal Pelajaran Hari Ini'
                : `Jadwal Hari ${selectedDay}`}
            </Text>

            <Text style={styles.scheduleHeadingSubtitle}>
              {formatLongDate(parseDateKey(selectedDateKey))}
            </Text>
          </View>

          <View style={styles.sessionBadge}>
            <Text style={styles.sessionBadgeText}>
              {selectedSchedules.length} Sesi Hari Ini
            </Text>
          </View>
        </View>

        {/* JADWAL DAN STATUS LOADING */}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />
            <Text style={styles.emptyText}>
              Memuat jadwal pelajaran...
            </Text>
          </View>
        ) : selectedSchedules.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="calendar-clear-outline"
                size={30}
                color={colors.textMuted}
              />
            </View>

            <Text style={styles.emptyTitle}>
              Belum Ada Jadwal
            </Text>

            <Text style={styles.emptyText}>
              {schedules.length === 0
                ? 'Jadwal belum tersedia. Pastikan kamu sudah bergabung dengan kelas dan guru sudah membuat jadwal.'
                : `Tidak ada jadwal pelajaran pada hari ${selectedDay}.`}
            </Text>
          </View>
        ) : (
          <View style={styles.timelineList}>
            {selectedSchedules.map((item, index) => {
              const status = getScheduleStatus(
                item,
                selectedDateKey,
                todayKey,
                nowMinutes
              );

              const statusStyle = getStatusStyle(status);
              const teacherName =
                teacherMap[item.teacher_id] || null;
              const kelas = getClassRelation(item);
              const room = getRoomText(item);
              const duration = durationMinutes(item);

              const meeting = meetings.find(
                (row) =>
                  row.schedule_id === item.id &&
                  row.tanggal === selectedDateKey
              );

              const attended = meeting
                ? attendanceMap[meeting.id]
                : null;

              const remainingMinutes = Math.max(
                0,
                toMinutes(item.jam_selesai) - nowMinutes
              );

              return (
                <View key={item.id} style={styles.timelineRow}>
                  {/* GARIS WAKTU */}
                  <View style={styles.timelineRail}>
                    <View
                      style={[
                        styles.timelineNode,
                        status === 'Sedang Berlangsung' &&
                          styles.timelineNodeLive,
                        status === 'Selesai' &&
                          styles.timelineNodeDone,
                      ]}
                    >
                      <Ionicons
                        name={
                          status === 'Selesai'
                            ? 'checkmark'
                            : status === 'Sedang Berlangsung'
                              ? 'play'
                              : 'time-outline'
                        }
                        size={17}
                        color={
                          status === 'Sedang Berlangsung'
                            ? '#063D31'
                            : status === 'Selesai'
                              ? GREEN
                              : colors.textMuted
                        }
                      />
                    </View>

                    {index < selectedSchedules.length - 1 ? (
                      <View
                        style={[
                          styles.timelineConnector,
                          status === 'Sedang Berlangsung' &&
                            styles.timelineConnectorLive,
                        ]}
                      />
                    ) : null}
                  </View>

                  {/* KARTU SESI */}
                  <View
                    style={[
                      styles.scheduleCard,
                      status === 'Sedang Berlangsung' &&
                        styles.scheduleCardLive,
                    ]}
                  >
                    {status === 'Sedang Berlangsung' ? (
                      <View style={styles.activeTopBar} />
                    ) : null}

                    <View style={styles.scheduleCardContent}>
                      <View style={styles.scheduleCardTop}>
                        <View
                          style={[
                            styles.statusBadge,
                            statusStyle.badge,
                          ]}
                        >
                          <View
                            style={[
                              styles.statusBadgeDot,
                              statusStyle.dot,
                            ]}
                          />

                          <Text
                            style={[
                              styles.statusBadgeText,
                              statusStyle.text,
                            ]}
                          >
                            {status}
                          </Text>
                        </View>

                        <View style={styles.timeColumn}>
                          <Text
                            style={[
                              styles.timeText,
                              status === 'Sedang Berlangsung' &&
                                styles.timeTextLive,
                            ]}
                          >
                            {formatTime(item.jam_mulai)} - {formatTime(item.jam_selesai)}
                          </Text>

                          <Text style={styles.timeNote}>
                            {selectedDateKey === todayKey &&
                            status === 'Sedang Berlangsung'
                              ? `Sisa ${remainingMinutes} menit`
                              : formatDuration(duration)}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.subject} numberOfLines={2}>
                        {getSubject(item)}
                        {kelas?.rombel ? ` ${kelas.rombel}` : ''}
                      </Text>

                      {teacherName ? (
                        <View style={styles.teacherRow}>
                          <View style={styles.teacherAvatar}>
                            <Ionicons
                              name="person"
                              size={14}
                              color="#A7C5FF"
                            />
                          </View>

                          <Text style={styles.teacherName} numberOfLines={1}>
                            {teacherName}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.lessonDetails}>
                        <View style={styles.lessonDetail}>
                          <Ionicons
                            name="time-outline"
                            size={20}
                            color={
                              status === 'Sedang Berlangsung'
                                ? GREEN
                                : colors.textMuted
                            }
                          />

                          <View style={styles.lessonDetailText}>
                            <Text style={styles.lessonTime}>
                              {formatTime(item.jam_mulai)} - {formatTime(item.jam_selesai)}
                            </Text>

                            <Text style={styles.lessonSubtext}>
                              {formatDuration(duration)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.lessonDetail}>
                          <Ionicons
                            name="location-outline"
                            size={21}
                            color={
                              status === 'Sedang Berlangsung'
                                ? GREEN
                                : colors.textMuted
                            }
                          />

                          <View style={styles.lessonDetailText}>
                            <Text style={styles.locationText}>
                              {room}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* TINDAKAN SESI */}
                      <View style={styles.actionRow}>
                        <Pressable
                          onPress={() => handleAttendance(item)}
                          disabled={
                            attendanceBusyId === item.id ||
                            Boolean(attended)
                          }
                          style={({ pressed }) => [
                            styles.actionButton,
                            styles.attendanceButton,
                            pressed && styles.buttonPressed,
                            Boolean(attended) &&
                              styles.actionButtonDisabled,
                          ]}
                        >
                          {attendanceBusyId === item.id ? (
                            <ActivityIndicator
                              size="small"
                              color="#063D31"
                            />
                          ) : (
                            <Ionicons
                              name={
                                attended
                                  ? 'checkmark-circle'
                                  : 'person-add-outline'
                              }
                              size={16}
                              color="#063D31"
                            />
                          )}

                          <Text style={styles.attendanceButtonText}>
                            {attended ? 'Sudah Hadir' : 'Absensi Hadir'}
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => handleOpenOnline(item)}
                          style={({ pressed }) => [
                            styles.actionButton,
                            styles.onlineButton,
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <Ionicons
                            name="videocam-outline"
                            size={17}
                            color="#FFFFFF"
                          />

                          <Text style={styles.onlineButtonText}>
                            Masuk Online
                          </Text>
                        </Pressable>
                      </View>
                    </View>
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },

  // HEADER JADWAL
  pageHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },

  pageTitleWrap: {
    flex: 1,
  },

  pageTitle: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.heavy,
  },

  pageSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
  },

  weekBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
  },

  weekBadgeText: {
    color: '#A7C5FF',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },

  // RINGKASAN
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },

  statCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 120,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.sm + 2,
    justifyContent: 'space-between',
  },

  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },

  statLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  statIconBlue: {
    width: 29,
    height: 29,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(59,130,246,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statIconGreen: {
    width: 29,
    height: 29,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(54,214,160,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statIconOrange: {
    width: 29,
    height: 29,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,181,71,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },

  statNumber: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.heavy,
    lineHeight: 35,
  },

  statUnit: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },

  // PILIH HARI
  calendarSection: {
    marginBottom: spacing.xl,
  },

  calendarHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },

  calendarDatePill: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },

  todayDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: GREEN,
  },

  calendarDateText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    flexShrink: 1,
  },

  dateList: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },

  dateCard: {
    width: 75,
    height: 96,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  dateCardSelected: {
    backgroundColor: RED,
    borderColor: RED,
  },

  dateDay: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },

  dateNumber: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginTop: 3,
  },

  dateTextSelected: {
    color: '#FFFFFF',
  },

  dateIndicator: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    marginTop: spacing.xs,
  },

  dateIndicatorSelected: {
    backgroundColor: '#FFFFFF',
  },

  dateIndicatorPlaceholder: {
    height: 11,
    marginTop: spacing.xs,
  },

  // JUDUL LIST
  scheduleHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  scheduleHeadingLeft: {
    flex: 1,
  },

  scheduleHeadingTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },

  scheduleHeadingSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },

  sessionBadge: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },

  sessionBadgeText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },

  // GARIS WAKTU DAN KARTU
  timelineList: {
    gap: spacing.md,
  },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },

  timelineRail: {
    width: 30,
    alignItems: 'center',
  },

  timelineNode: {
    width: 29,
    height: 29,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  timelineNodeLive: {
    width: 38,
    height: 38,
    marginTop: -4,
    backgroundColor: GREEN,
    borderColor: 'rgba(54,214,160,0.27)',
  },

  timelineNodeDone: {
    backgroundColor: 'rgba(54,214,160,0.15)',
    borderColor: colors.cardAlt,
  },

  timelineConnector: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },

  timelineConnectorLive: {
    backgroundColor: GREEN,
  },

  scheduleCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  scheduleCardLive: {
    borderColor: 'rgba(54,214,160,0.45)',
    backgroundColor: '#202126',
  },

  activeTopBar: {
    height: 4,
    backgroundColor: GREEN,
  },

  scheduleCardContent: {
    padding: spacing.md,
  },

  // STATUS DAN JAM
  scheduleCardTop: {
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
    flexShrink: 1,
  },

  statusLive: {
    backgroundColor: 'rgba(54,214,160,0.16)',
  },

  statusDone: {
    backgroundColor: 'rgba(154,163,178,0.13)',
  },

  statusUpcoming: {
    backgroundColor: colors.cardAlt,
  },

  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
  },

  statusDotLive: {
    backgroundColor: GREEN,
  },

  statusDotDone: {
    backgroundColor: colors.textMuted,
  },

  statusDotUpcoming: {
    backgroundColor: colors.textFaint,
  },

  statusBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },

  statusTextLive: {
    color: GREEN,
  },

  statusTextDone: {
    color: colors.textMuted,
  },

  statusTextUpcoming: {
    color: colors.textMuted,
  },

  timeColumn: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },

  timeText: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },

  timeTextLive: {
    color: GREEN,
  },

  timeNote: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 3,
  },

  // INFORMASI PELAJARAN
  subject: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    lineHeight: 24,
  },

  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },

  teacherAvatar: {
    width: 27,
    height: 27,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(59,130,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  teacherName: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },

  // WAKTU DAN LOKASI
  lessonDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginTop: spacing.md,
  },

  lessonDetail: {
    flex: 1,
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },

  lessonDetailText: {
    flex: 1,
  },

  lessonTime: {
    color: colors.text,
    fontSize: fontSize.xs,
  },

  lessonSubtext: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  locationText: {
    color: colors.text,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },

  // TOMBOL
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  actionButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },

  attendanceButton: {
    backgroundColor: GREEN,
  },

  attendanceButtonText: {
    color: '#063D31',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },

  onlineButton: {
    backgroundColor: BLUE,
  },

  onlineButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },

  actionButtonDisabled: {
    opacity: 0.65,
  },

  // EMPTY STATE DAN LOADING
  loading: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },

  emptyCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.sm,
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
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
    lineHeight: 21,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
