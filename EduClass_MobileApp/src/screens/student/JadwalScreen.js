import { FloatingSafeAreaView } from '../../components/FloatingTabBar';
import { useAppTheme } from '../../context/ThemeContext';
import AppBackdrop from '../../components/AppBackdrop';
import { useCallback, useMemo, useState, useRef } from 'react';
import { fetchStudentAssignments } from '../../services/assignmentService';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  useWindowDimensions,
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
import { fetchStudentWeekMeetings, markOwnAttendance, validateMeetingUrl } from '../../services/meetingService';

import {
  colors,
  fontSize,
  fontWeight,
  radius,
  spacing,
} from '../../core/theme';

function deadlineDate(item) {
  const value = item.deadline_at || item.deadline;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function assignmentStatus(item, now, colors) {
  const status = item.submission?.status;
  if (status === 'perlu_revisi') return { label: 'Perlu revisi', color: colors.statusYellow, kind: 'revision' };
  if (status === 'dinilai') return { label: 'Sudah dinilai', color: colors.statusGreen, kind: 'done' };
  if (item.submission) return { label: 'Sudah dikumpulkan', color: colors.statusGreen, kind: 'done' };
  if (deadlineDate(item)?.getTime() < now.getTime()) return { label: 'Lewat tenggat', color: colors.danger, kind: 'late' };
  return { label: 'Belum dikumpulkan', color: colors.warning, kind: 'pending' };
}

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

const ATTENDANCE_LABELS = {
  hadir: 'Hadir',
  izin: 'Izin',
  sakit: 'Sakit',
  alpa: 'Tidak hadir',
};

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

function getStatusStyle(status, styles) {
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
  const { colors, mode: appThemeMode } = useAppTheme();
  const styles = make_styles(colors);

  const { width: screenWidth } = useWindowDimensions();
  const compact = screenWidth < 600;
  const { user, profile } = useAuth();
  const studentId = user?.uid || user?.id || profile?.id;

  const [assignments, setAssignments] = useState([]);
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentLoading, setAssignmentLoading] = useState(true);
  const assignmentRequest = useRef(0);
  const loadAssignments = useCallback(async () => {
    const request = ++assignmentRequest.current;
    setAssignmentLoading(true);
    setAssignmentError('');
    try {
      if (!studentId) throw new Error('Akun siswa tidak ditemukan.');
      const result = await fetchStudentAssignments(studentId);
      if (result.error) throw result.error;
      if (request === assignmentRequest.current) setAssignments(result.data || []);
    } catch (err) {
      if (request === assignmentRequest.current) {
        setAssignments([]);
        setAssignmentError(err.message || 'Gagal memuat tenggat tugas.');
      }
    } finally {
      if (request === assignmentRequest.current) setAssignmentLoading(false);
    }
  }, [studentId]);
  useFocusEffect(useCallback(() => {
    loadAssignments();
    return () => { assignmentRequest.current++; };
  }, [loadAssignments]));
  const [meetings, setMeetings] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyAttendance, setBusyAttendance] = useState(null);

  const [selectedDateKey, setSelectedDateKey] = useState(
    toDateKey(new Date())
  );

  // Pilih tanggal pada rentang dua hari sebelum sampai dua hari sesudah hari ini.
  const now = new Date();
  const todayKey = toDateKey(now);
  const today = DAY_BY_JS[now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const selectedDate = parseDateKey(selectedDateKey);
  const dateWindow = useMemo(() => [-2, -1, 0, 1, 2].map((offset) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return { date, key: toDateKey(date) };
  }), [todayKey]);
  const weekStartKey = dateWindow[0].key;
  const weekEndKey = dateWindow[4].key;

  // ===================================================
  // MEMUAT JADWAL DARI DATABASE YANG SUDAH ADA
  // ===================================================

  const loadSchedules = useCallback(async (isRefresh = false) => {
    if (!studentId) {
      setMeetings([]);
      setAttendanceMap({});
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
      // Kalender siswa menggunakan jadwal yang ditetapkan pada setiap pertemuan.
      const { data: weekData, error: meetingError } = await fetchStudentWeekMeetings({
        studentId,
        weekStartKey,
        weekEndKey,
      });
      if (meetingError) setError(meetingError.message);
      setMeetings(weekData?.meetings || []);
      setAttendanceMap(weekData?.attendanceMap || {});
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

  const selectedMeetings = meetings
    .filter((item) => String(item.tanggal || '').slice(0, 10) === selectedDateKey)
    .map((item) => ({ ...item, isMeeting: true }));
  
  const selectedSchedules = selectedMeetings.sort((a, b) => String(a.jam_mulai || '').localeCompare(String(b.jam_mulai || '')));

  const deadlineEntries = assignments.map(item => {
    const date = deadlineDate(item);
    return date ? { item, date, key: toDateKey(date), ...assignmentStatus(item, now, colors) } : null;
  }).filter(Boolean);
  const selectedAssignments = deadlineEntries.filter(entry => entry.key === selectedDateKey)
    .sort((a,b) => a.date.getTime() - b.date.getTime());
  const dateMarkers = {};
  deadlineEntries.forEach(entry => {
    const markers = dateMarkers[entry.key] || (dateMarkers[entry.key] = []);
    if (!markers.includes(entry.color)) markers.push(entry.color);
  });
  meetings.forEach(meeting => {
    const key = String(meeting.tanggal || '').slice(0,10);
    if (!key) return;
    const markers = dateMarkers[key] || (dateMarkers[key] = []);
    if (!markers.includes(BLUE)) markers.push(BLUE);
  });
  const refreshAll = () => { loadSchedules(true); loadAssignments(); };

  const totalDuration = meetings.filter((item) => String(item.tanggal || '').slice(0, 10) === todayKey)
    .reduce((total, item) => total + durationMinutes(item), 0);
  const todayActiveCount = meetings.filter((item) => String(item.tanggal || '').slice(0, 10) === todayKey && getScheduleStatus(item, todayKey, todayKey, nowMinutes) === 'Sedang Berlangsung').length;

  const monthLabel = selectedDate.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  const weekNumber = getWeekNumber(selectedDate);

  // ===================================================
  // MASUK ONLINE
  // ===================================================

  const handleAttendance = async (meeting) => {
    if (busyAttendance || !meeting) return;
    setBusyAttendance(meeting.id);
    setError('');
    try {
      const { data, error: saveError } = await markOwnAttendance(meeting.id);
      if (saveError) throw saveError;
      setAttendanceMap(old => ({ ...old, [meeting.id]: data }));
      notify('Presensi berhasil', 'Kehadiran kamu sudah tercatat.');
    } catch (err) {
      setError(err.message || 'Gagal melakukan presensi.');
      notify('Presensi gagal', err.message || 'Muat ulang jadwal dan coba kembali.');
    } finally { setBusyAttendance(null); }
  };

  const handleOpenOnline = async (schedule) => {
    const meetingUrl = schedule.meeting_url;

    if (!meetingUrl) {
      notify(
        'Tautan belum tersedia',
        'Guru belum menambahkan tautan pertemuan online pada pertemuan ini.'
      );
      return;
    }

    try {
      await Linking.openURL(validateMeetingUrl(meetingUrl));
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
    <FloatingSafeAreaView style={styles.safe} edges={['top']}><AppBackdrop />
      <DashboardHeader
        variant="siswa"
        title="Jadwal"
        onAvatarPress={() => navigation.navigate('Profil')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing || assignmentLoading}
            onRefresh={refreshAll}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        }
      >
        <FormAlert message={error} />
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <Text style={{color:colors.text,fontSize:16,fontWeight:'700'}}>{formatLongDate(selectedDate)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Muat ulang jadwal" onPress={refreshAll} disabled={refreshing || assignmentLoading} style={{padding:8}}><Ionicons name="refresh-outline" size={22} color={BLUE}/></Pressable>
        </View>
        <View style={[styles.calendarSection,{marginBottom:16}]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateList}>
            {dateWindow.map(({ date, key }) => {
              const selected = key === selectedDateKey;
              const markers = dateMarkers[key] || [];
              return <Pressable key={key} accessibilityRole="button" onPress={() => setSelectedDateKey(key)} style={[styles.dateCard, { width: 62, height: 78 }, selected && styles.dateCardSelected]}>
                <Text style={[styles.dateDay, selected && styles.dateTextSelected]}>{date.toLocaleDateString('id-ID', { weekday: 'short' })}</Text>
                <Text style={[styles.dateNumber, selected && styles.dateTextSelected]}>{date.getDate()}</Text>
                <View style={{ flexDirection: 'row', height: 8, gap: 3, alignItems: 'center' }}>{markers.slice(0, 4).map((color) => <View key={color} style={[styles.dateIndicator, { backgroundColor: color }, selected && { backgroundColor: '#FFFFFF' }]} />)}</View>
              </Pressable>;
            })}
          </ScrollView>
          <View style={[styles.legend,compact && {gap:8,marginTop:8}]}>{[[BLUE,compact?'Pelajaran':'Pelajaran / pertemuan'],[colors.warning,'Tugas'],[colors.statusGreen,'Terkumpul'],[colors.danger,compact?'Terlambat':'Lewat tenggat'],[colors.statusYellow,'Revisi']].map(([color,label]) => <View key={label} style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:color}]} /><Text style={[styles.legendText,compact && {fontSize:12}]}>{label}</Text></View>)}</View>
        </View>

        <View style={styles.deadlineSection}>
          <View style={styles.scheduleHeading}>
            <View style={styles.scheduleHeadingLeft}>
              <Text style={styles.scheduleHeadingTitle}>Tenggat Tugas</Text>
              
            </View>
            <View style={styles.sessionBadge}><Text style={styles.sessionBadgeText}>{assignmentLoading || assignmentError ? '—' : selectedAssignments.length} Tugas</Text></View>
          </View>
          {assignmentLoading ? <ActivityIndicator color={colors.primary} /> : assignmentError ? <FormAlert message={assignmentError} /> : selectedAssignments.length === 0 ? <Text style={styles.noDeadline}>Tidak ada tenggat</Text> : selectedAssignments.map(({item,date,label,color}) => (
            <Pressable key={item.id} accessibilityRole="button" onPress={() => navigation.navigate('Tugas', { screen: 'DetailTugas', params: { assignmentId: item.id } })} style={[styles.deadlineCard,{borderLeftColor:color}]}>
              <View style={{flex:1,minWidth:0,gap:6}}>
                <Text style={styles.deadlineSubject}>{[item.class?.nama_mapel || item.class_nama,item.class?.rombel].filter(Boolean).join(' • ')}</Text>
                <Text style={styles.subject}>{item.judul}</Text>
                <Text style={styles.lessonSubtext}>Tenggat {date.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})} • {label}</Text>
              </View>
              <View style={{alignItems:'flex-end',gap:8}}>
                {item.submission?.nilai != null ? <Text style={[styles.deadlineGrade,{color:colors.statusGreen}]}>{item.submission.nilai}/100</Text> : null}
                <Ionicons name="chevron-forward" size={20} color={color} />
              </View>
            </Pressable>
          ))}
        </View>

        {/* JUDUL DAFTAR SESI */}
        <View style={styles.scheduleHeading}>
          <View style={styles.scheduleHeadingLeft}>
            <Text style={styles.scheduleHeadingTitle}>
              Pelajaran
            </Text>

            
          </View>

          <View style={styles.sessionBadge}>
            <Text style={styles.sessionBadgeText}>
              {selectedSchedules.length} Sesi
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
              Tidak ada pelajaran
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

              const statusStyle = getStatusStyle(status, styles);
              const teacherName = item.classes?.teacher_nama || null;
              const kelas = getClassRelation(item);
              const room = getRoomText(item);
              const duration = durationMinutes(item);

              const meeting = meetings.find(
                (row) =>
                  (row.schedule_id === item.id || row.id === item.id) &&
                  row.tanggal === selectedDateKey
              );

              const attended = meeting
                ? attendanceMap[meeting.id]
                : null;
              const canAttend = Boolean(meeting?.presensi_dibuka_at && !meeting?.presensi_ditutup_at && !attended);
              const onlineUrl = meeting?.meeting_url || '';

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
                              color={colors.accentText}
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

                      {/* STATUS PRESENSI DAN TINDAKAN SESI */}
                      <View style={styles.actionRow}>
                        <Pressable disabled={!canAttend || !!busyAttendance} onPress={() => handleAttendance(meeting)} style={[
                          styles.attendanceStatus,
                          canAttend && styles.onlineButton,
                          attended?.status === 'hadir' && styles.attendanceStatusPresent,
                          attended?.status === 'alpa' && styles.attendanceStatusAbsent,
                        ]}>
                          <Ionicons
                            name={attended?.status === 'hadir' ? 'checkmark-circle' : attended?.status === 'alpa' ? 'close-circle' : 'time-outline'}
                            size={17}
                            color={attended?.status === 'hadir' ? GREEN : attended?.status === 'alpa' ? colors.danger : colors.textMuted}
                          />
                          <Text style={styles.attendanceStatusText}>
                            {attended?.status
                              ? ATTENDANCE_LABELS[attended.status] || attended.status
                              : canAttend ? (busyAttendance === meeting.id ? 'Menyimpan...' : 'Absen Hadir') : meeting ? 'Presensi belum dibuka / ditutup' : 'Belum ada pertemuan'}
                          </Text>
                        </Pressable>

                        <Pressable
                          disabled={!onlineUrl}
                          onPress={() => handleOpenOnline(meeting)}
                          style={({ pressed }) => [
                            styles.actionButton,
                            styles.onlineButton,
                            !onlineUrl && { opacity: 0.45 },
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <Ionicons
                            name="videocam-outline"
                            size={17}
                            color="#FFFFFF"
                          />

                          <Text style={styles.onlineButtonText}>
                            {onlineUrl ? "Masuk Online" : "Tidak ada link online"}
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
    </FloatingSafeAreaView>
  );
}

// =====================================================
// STYLE
// =====================================================

const GUTTER = spacing.md + spacing.xs;

const make_styles = (colors) => (StyleSheet.create({
  legend: {flexDirection:'row',flexWrap:'wrap',justifyContent:'center',alignItems:'center',gap:12,marginTop:12,width:'100%'},
  legendItem: {flexDirection:'row',alignItems:'center',gap:5},
  legendDot: {width:8,height:8,borderRadius:4},
  legendText: {color:colors.textMuted,fontSize:12},
  deadlineSection: {marginBottom:spacing.xl,gap:spacing.sm},
  deadlineCard: {flexDirection:'row',alignItems:'center',gap:12,backgroundColor:colors.card,borderColor:colors.border,borderWidth:1,borderLeftWidth:4,borderRadius:radius.lg,padding:spacing.md},
  deadlineSubject: {color:colors.primary,fontSize:fontSize.sm,fontWeight:fontWeight.semibold},
  deadlineGrade: {fontSize:fontSize.lg,fontWeight:fontWeight.bold},
  noDeadline: {color:colors.textMuted,backgroundColor:colors.card,borderRadius:radius.md,padding:spacing.md,fontSize:fontSize.sm},
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
    color: colors.accentText,
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
    backgroundColor: colors.cardAlt,
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
    color: colors.statusGreen,
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
    color: colors.statusGreen,
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

  attendanceStatus: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },

  attendanceStatusPresent: {
    backgroundColor: colors.successSoft,
  },

  attendanceStatusAbsent: {
    backgroundColor: colors.dangerSoft,
  },

  attendanceStatusText: {
    color: colors.text,
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
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },

  emptyIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
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
    lineHeight: 21,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
}));
