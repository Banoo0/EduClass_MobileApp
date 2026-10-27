
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

import DashboardHeader from '../../components/DashboardHeader';
import AppInput from '../../components/AppInput';
import Chip from '../../components/Chip';
import EmptyState from '../../components/EmptyState';
import FormAlert from '../../components/FormAlert';

import { useAuth } from '../../context/AuthContext';
import {
  fetchStudentClasses,
  joinClassByToken,
} from '../../services/classServices';
import { supabase } from '../../core/supabase';

import {
  colors,
  fontSize,
  fontWeight,
  radius,
  spacing,
} from '../../core/theme';

const ACTION_RED = '#A40000';
const ACTION_RED_PRESSED = '#860000';

function notify(title, message) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function getSubjectIcon(subject = '') {
  const name = subject.toLowerCase();

  if (
    name.includes('kimia') ||
    name.includes('ipa') ||
    name.includes('fisika')
  ) {
    return 'flask-outline';
  }

  if (
    name.includes('sejarah') ||
    name.includes('ips') ||
    name.includes('geografi')
  ) {
    return 'earth-outline';
  }

  if (
    name.includes('matematika') ||
    name.includes('informatika')
  ) {
    return 'calculator-outline';
  }

  if (
    name.includes('bahasa') ||
    name.includes('indonesia') ||
    name.includes('inggris')
  ) {
    return 'book-outline';
  }

  return 'school-outline';
}

export default function KelasScreen({ navigation }) {
  const { user, profile } = useAuth();
  const studentId = user?.id || profile?.id;

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [expandedClassId, setExpandedClassId] = useState(null);

  // ================================================
  // AMBIL KELAS DAN INFORMASI TAMBAHAN
  // ================================================

  const loadClasses = useCallback(async (isRefresh = false) => {
    if (!studentId) {
      setClasses([]);
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
      const { data, error: requestError } =
        await fetchStudentClasses(studentId);

      if (requestError) {
        setError(requestError.message);
        return;
      }

      const baseClasses = data || [];

      if (baseClasses.length === 0) {
        setClasses([]);
        return;
      }

      const classIds = baseClasses.map((item) => item.id);

      const teacherIds = [
        ...new Set(
          baseClasses
            .map((item) => item.teacher_id)
            .filter(Boolean)
        ),
      ];

      // Data tambahan bersifat opsional.
      // Jika RLS membatasi query ini, kelas tetap ditampilkan.

      let teacherMap = {};
      let memberCountMap = {};
      let scheduleCountMap = {};
      let schedulesByClass = {};

      if (teacherIds.length > 0) {
        const { data: teachers, error: teachersError } =
          await supabase
            .from('profiles')
            .select('id, nama_lengkap')
            .in('id', teacherIds);

        if (!teachersError && teachers) {
          teacherMap = Object.fromEntries(
            teachers.map((item) => [
              item.id,
              item.nama_lengkap,
            ])
          );
        }
      }

      const { data: memberships, error: membersError } =
        await supabase
          .from('class_members')
          .select('class_id')
          .in('class_id', classIds);

      if (!membersError && memberships) {
        memberships.forEach((item) => {
          memberCountMap[item.class_id] =
            (memberCountMap[item.class_id] || 0) + 1;
        });
      }

      const { data: schedules, error: schedulesError } =
        await supabase
          .from('schedules')
          .select(
            'id, class_id, judul, hari, jam_mulai, jam_selesai, ruang, gedung'
          )
          .in('class_id', classIds);

      if (!schedulesError && schedules) {
        schedules.forEach((item) => {
          if (!schedulesByClass[item.class_id]) {
            schedulesByClass[item.class_id] = [];
          }

          schedulesByClass[item.class_id].push(item);

          scheduleCountMap[item.class_id] =
            (scheduleCountMap[item.class_id] || 0) + 1;
        });

        Object.values(schedulesByClass).forEach((items) => {
          items.sort((a, b) =>
            String(a.jam_mulai || '').localeCompare(
              String(b.jam_mulai || '')
            )
          );
        });
      }

      const enrichedClasses = baseClasses.map((item) => ({
        ...item,
        nama_guru: teacherMap[item.teacher_id] || null,
        jumlah_siswa: memberCountMap[item.id],
        jumlah_jadwal: scheduleCountMap[item.id],
        schedules: schedulesByClass[item.id] || [],
      }));

      setClasses(enrichedClasses);
    } catch (err) {
      setError(err.message || 'Gagal memuat daftar kelas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      loadClasses();
    }, [loadClasses])
  );

  // ================================================
  // GABUNG KELAS DENGAN TOKEN
  // ================================================

  const handleJoinClass = async () => {
    const normalizedToken = token.trim().toUpperCase();

    if (!normalizedToken) {
      setError('Masukkan token yang diberikan oleh guru.');
      return;
    }

    setJoining(true);
    setError('');

    try {
      const { data, error: joinError } =
        await joinClassByToken(normalizedToken);

      if (joinError) {
        setError(joinError.message || 'Gagal bergabung dengan kelas.');
        return;
      }

      if (!data) {
        setError('Kelas tidak ditemukan. Periksa kembali tokennya.');
        return;
      }

      setToken('');
      await loadClasses(true);

      notify(
        'Berhasil bergabung!',
        'Kelas sudah ditambahkan ke daftar kelas kamu.'
      );
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat bergabung.');
    } finally {
      setJoining(false);
    }
  };

  // ================================================
  // SALIN TOKEN KELAS
  // ================================================

  const handleCopyToken = async (classToken) => {
    if (!classToken) {
      notify('Token tidak tersedia', 'Kode kelas tidak ditemukan.');
      return;
    }

    try {
      await Clipboard.setStringAsync(String(classToken));

      notify(
        'Token disalin',
        `Token ${classToken} sudah disalin.`
      );
    } catch (err) {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard?.writeText
      ) {
        try {
          await navigator.clipboard.writeText(String(classToken));
          notify('Token disalin', `Token ${classToken} sudah disalin.`);
          return;
        } catch (_) {
          // Tampilkan pesan gagal di bawah.
        }
      }

      notify('Gagal menyalin', 'Silakan coba kembali.');
    }
  };

  // ================================================
  // TAMPILAN
  // ================================================

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header konsisten dengan Beranda siswa */}
      <DashboardHeader
        variant="siswa"
        title="Beranda"
        onAvatarPress={() => navigation.getParent()?.navigate('Profil')}
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
        {/* JUDUL HALAMAN */}
        <View style={styles.pageHeading}>
          <Text style={styles.pageTitle}>Kelas Saya</Text>
          <Text style={styles.pageSubtitle}>
            Semua kelas yang sedang kamu ikuti
          </Text>
        </View>

        <FormAlert message={error} />

        {/* KARTU GABUNG KELAS */}
        <View style={styles.joinCard}>
          <View style={styles.joinHeader}>
            <View style={styles.joinIcon}>
              <Ionicons
                name="key"
                size={27}
                color="#FFB547"
              />
            </View>

            <View style={styles.joinHeaderText}>
              <Text style={styles.joinTitle}>
                Gabung Kelas Baru
              </Text>

              <Text style={styles.joinDescription}>
                Masukkan token kelas yang diberikan oleh gurumu
              </Text>
            </View>
          </View>

          <AppInput
            icon="keypad-outline"
            placeholder="CONTOH: KIM-9C-03"
            value={token}
            onChangeText={(value) => setToken(value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={handleJoinClass}
          />

          <Pressable
            accessibilityRole="button"
            onPress={handleJoinClass}
            disabled={joining || !token.trim()}
            style={({ pressed }) => [
              styles.joinButton,
              pressed && styles.buttonPressed,
              (joining || !token.trim()) && styles.buttonDisabled,
            ]}
          >
            {joining ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="people-outline"
                  size={19}
                  color="#FFFFFF"
                />

                <Text style={styles.joinButtonText}>
                  + Join Kelas
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* JUDUL DAFTAR KELAS */}
        <View style={styles.listHeading}>
          <Text style={styles.listHeadingTitle}>
            Daftar Kelas Terdaftar
          </Text>

          <Text style={styles.semesterText}>
            {profile?.semester || 'Semester Aktif'}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />

            <Text style={styles.loadingText}>
              Memuat kelas...
            </Text>
          </View>
        ) : classes.length === 0 ? (
          <EmptyState
            icon="school-outline"
            text="Kamu belum bergabung dengan kelas mana pun. Masukkan token dari guru untuk mulai bergabung."
          />
        ) : (
          <View style={styles.classList}>
            {classes.map((item) => {
              const schedules = item.schedules || [];
              const firstSchedule = schedules[0];
              const expanded = expandedClassId === item.id;

              return (
                <View key={item.id} style={styles.classCard}>
                  {/* INFORMASI KELAS */}
                  <View style={styles.classHeader}>
                    <View style={styles.subjectIcon}>
                      <Ionicons
                        name={getSubjectIcon(item.nama_mapel)}
                        size={28}
                        color={
                          item.nama_mapel?.toLowerCase().includes('sejarah')
                            ? '#FFB547'
                            : '#9DBDFF'
                        }
                      />
                    </View>

                    <View style={styles.classInfo}>
                      <Text
                        style={styles.subject}
                        numberOfLines={2}
                      >
                        {item.nama_mapel}
                        {item.rombel ? ` ${item.rombel}` : ''}
                      </Text>

                      <View style={styles.teacherRow}>
                        <Ionicons
                          name="person-outline"
                          size={15}
                          color={colors.textMuted}
                        />

                        <Text
                          style={styles.teacherName}
                          numberOfLines={1}
                        >
                          {item.nama_guru || 'Guru pengampu'}
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
                        {item.aktif ? 'AKTIF' : 'DITUTUP'}
                      </Text>
                    </View>
                  </View>

                  {/* CHIPS INFORMASI */}
                  <View style={styles.infoChips}>
                    {typeof item.jumlah_siswa === 'number' ? (
                      <View style={styles.infoChip}>
                        <Ionicons
                          name="people-outline"
                          size={15}
                          color={colors.textMuted}
                        />

                        <Text style={styles.infoChipText}>
                          {item.jumlah_siswa} Siswa
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.taskChip}>
                      <Ionicons
                        name="calendar-outline"
                        size={15}
                        color="#FFB4B4"
                      />

                      <Text style={styles.taskChipText}>
                        {item.jumlah_jadwal ?? '—'} Jadwal Aktif
                      </Text>
                    </View>
                  </View>

                  {/* TOKEN */}
                  {item.token ? (
                    <View style={styles.tokenRow}>
                      <View style={styles.tokenPill}>
                        <Ionicons
                          name="key-outline"
                          size={15}
                          color={colors.textMuted}
                        />

                        <Text style={styles.tokenText}>
                          {item.token}
                        </Text>

                        <Pressable
                          onPress={() => handleCopyToken(item.token)}
                          accessibilityRole="button"
                          accessibilityLabel="Salin token kelas"
                          hitSlop={8}
                        >
                          <Ionicons
                            name="copy-outline"
                            size={18}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {/* DETAIL KELAS DI HALAMAN YANG SAMA */}
                  {expanded ? (
                    <View style={styles.detailBox}>
                      <DetailRow
                        icon="book-outline"
                        label="Mata Pelajaran"
                        value={item.nama_mapel}
                      />

                      <DetailRow
                        icon="people-outline"
                        label="Rombel"
                        value={item.rombel || 'Belum diatur'}
                      />

                      <DetailRow
                        icon="calendar-outline"
                        label="Tahun Ajaran"
                        value={item.tahun_ajaran || 'Belum diatur'}
                      />

                      <DetailRow
                        icon="time-outline"
                        label="Semester"
                        value={item.semester || 'Belum diatur'}
                      />

                      <View style={styles.detailDivider} />

                      <Text style={styles.detailSectionTitle}>
                        Jadwal Pelajaran
                      </Text>

                      {schedules.length ? (
                        schedules.map((schedule) => (
                          <View
                            key={schedule.id}
                            style={styles.scheduleItem}
                          >
                            <View style={styles.scheduleDayIcon}>
                              <Ionicons
                                name="calendar-outline"
                                size={18}
                                color={colors.primary}
                              />
                            </View>

                            <View style={styles.scheduleInfo}>
                              <Text style={styles.scheduleDay}>
                                {schedule.hari}
                              </Text>

                              <Text style={styles.scheduleTime}>
                                {schedule.jam_mulai?.slice(0, 5) || '--:--'}
                                {' – '}
                                {schedule.jam_selesai?.slice(0, 5) || '--:--'}
                              </Text>

                              <Text style={styles.scheduleLocation}>
                                {[schedule.ruang, schedule.gedung]
                                  .filter(Boolean)
                                  .join(' • ') || 'Lokasi belum diatur'}
                              </Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.noSchedule}>
                          Belum ada jadwal yang tersedia.
                        </Text>
                      )}
                    </View>
                  ) : null}

                  {/* TOMBOL DETAIL */}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      setExpandedClassId(expanded ? null : item.id)
                    }
                    style={({ pressed }) => [
                      styles.detailButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.detailButtonText}>
                      {expanded ? 'Tutup Detail Kelas' : 'Lihat Detail Kelas'}
                    </Text>

                    <Ionicons
                      name={expanded ? 'chevron-up' : 'arrow-forward'}
                      size={19}
                      color="#FFFFFF"
                    />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Baris informasi untuk detail kelas.
function DetailRow({ icon, label, value }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons
        name={icon}
        size={16}
        color={colors.textMuted}
      />

      <Text style={styles.detailLabel}>
        {label}
      </Text>

      <Text style={styles.detailValue}>
        {value}
      </Text>
    </View>
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
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },

  pageHeading: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },

  pageTitle: {
    color: colors.text,
    fontSize: 29,
    fontWeight: fontWeight.heavy,
  },

  pageSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    lineHeight: 23,
    marginTop: spacing.xs,
    maxWidth: 300,
  },

  // KARTU JOIN
  joinCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },

  joinHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },

  joinIcon: {
    width: 55,
    height: 55,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,181,71,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  joinHeaderText: {
    flex: 1,
  },

  joinTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },

  joinDescription: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 21,
    marginTop: spacing.xs,
  },

  joinButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: ACTION_RED,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },

  joinButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },

  buttonPressed: {
    opacity: 0.78,
  },

  buttonDisabled: {
    opacity: 0.55,
  },

  // JUDUL LIST
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  listHeadingTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },

  semesterText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },

  loading: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },

  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },

  classList: {
    gap: spacing.md,
  },

  // KARTU KELAS
  classCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },

  classHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },

  subjectIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },

  classInfo: {
    flex: 1,
    paddingTop: 2,
  },

  subject: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    lineHeight: 23,
  },

  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },

  teacherName: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },

  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.successSoft,
  },

  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },

  activeText: {
    color: colors.success,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },

  inactiveBadge: {
    backgroundColor: colors.dangerSoft,
  },

  inactiveDot: {
    backgroundColor: colors.danger,
  },

  inactiveText: {
    color: colors.danger,
  },

  // CHIPS
  infoChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },

  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },

  infoChipText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  taskChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(164,0,0,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },

  taskChipText: {
    color: '#FFB4B4',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },

  // TOKEN
  tokenRow: {
    alignItems: 'flex-end',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },

  tokenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  tokenText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: 1,
    flexShrink: 1,
  },

  // DETAIL KELAS
  detailButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: ACTION_RED,
    borderRadius: radius.md,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },

  detailButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },

  detailBox: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },

  detailLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },

  detailValue: {
    flexShrink: 1,
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textAlign: 'right',
  },

  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },

  detailSectionTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },

  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },

  scheduleDayIcon: {
    width: 35,
    height: 35,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scheduleInfo: {
    flex: 1,
  },

  scheduleDay: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },

  scheduleTime: {
    color: colors.primary,
    fontSize: fontSize.sm,
    marginTop: 3,
  },

  scheduleLocation: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 3,
  },

  noSchedule: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
