import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import Chip from '../../components/Chip';
import DashboardHeader from '../../components/DashboardHeader';
import EmptyState from '../../components/EmptyState';
import FormAlert from '../../components/FormAlert';
import ProgressRing from '../../components/ProgressRing';
import ScheduleCard from '../../components/ScheduleCard';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import TaskCard from '../../components/TaskCard';
import { useAuth } from '../../context/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '../../core/theme';
import { getStudentDashboard } from '../../services/dashboardService';
import { formatTodayChip, getScheduleStatus, isDueSoon, isThisWeek } from '../../utils/dateHelper';

const sudahDikumpulkan = (t) => t.status_pengumpulan === 'dikumpulkan';

// Semua angka Beranda dihitung dari data mentah dan waktu sekarang, tidak ada yang ditulis mati.
function buildSummary(data, now) {
  const tugas = data?.tugas ?? [];
  const aktif = tugas.filter((t) => !sudahDikumpulkan(t) && t.deadline && dayjs(t.deadline).isAfter(now));
  const mendesak = aktif.filter((t) => isDueSoon(t.deadline, now)).sort((a, b) => dayjs(a.deadline).diff(dayjs(b.deadline)));
  const mingguIni = tugas.filter((t) => isThisWeek(t.deadline, now));
  const jadwal = [...(data?.jadwal ?? [])]
    .sort((a, b) => String(a.jam_mulai).localeCompare(String(b.jam_mulai)))
    .map((j) => ({ ...j, status: getScheduleStatus(j.jam_mulai, j.jam_selesai, now) }));

  return {
    mendesak,
    totalAktif: aktif.length,
    totalSelesai: tugas.filter(sudahDikumpulkan).length,
    minggu: { selesai: mingguIni.filter(sudahDikumpulkan).length, total: mingguIni.length },
    jadwal,
  };
}

function kalimatMotivasi(selesai, total) {
  const sisa = total - selesai;
  if (total === 0) return 'Belum ada tugas minggu ini. Nikmati waktu belajarmu!';
  if (sisa === 0) return 'Luar biasa! Semua tugas minggu ini sudah selesai.';
  if (selesai / total >= 0.5) return `Hebat! Sisa ${sisa} tugas lagi untuk capai target mingguan.`;
  return `Ayo semangat! Masih ada ${sisa} tugas minggu ini.`;
}

export default function BerandaScreen({ navigation }) {
  const { profile } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: result, error: err } = await getStudentDashboard();
    if (err) {
      setError(err.message || 'Beranda gagal dimuat. Coba lagi.');
      return;
    }
    setData(result);
    setError(null);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const keTugas = () => navigation.navigate('Tugas');
  const keJadwal = () => navigation.navigate('Jadwal');

  const namaDepan = (profile?.nama_lengkap ?? '').trim().split(/\s+/)[0] || 'Siswa';
  const infoKelas = [profile?.rombel ? `Kelas ${profile.rombel}` : null, profile?.school?.nama_sekolah].filter(Boolean).join(' • ');

  const s = buildSummary(data, dayjs());
  const rasio = s.minggu.total ? s.minggu.selesai / s.minggu.total : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DashboardHeader variant="siswa" title="Beranda" onAvatarPress={() => navigation.navigate('Profil')} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.card} />
          }
        >
          {/* Sapaan */}
          <View style={styles.greeting}>
            <View>
              <View style={styles.avatarLarge}>
                <Ionicons name="person-outline" size={36} color={colors.bg} />
              </View>
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.hi} numberOfLines={1}>
                Hi, {namaDepan}!
              </Text>
              {infoKelas ? <Chip label={infoKelas} dot style={styles.kelasChip} /> : null}
            </View>
          </View>

          <FormAlert message={error} />

          {data ? (
            <>
              {/* Progres Mingguan */}
              <View style={styles.progressCard}>
                <View style={styles.progressGlow} />
                <ProgressRing
                  progress={rasio}
                  size={104}
                  strokeWidth={10}
                  label={`${Math.round(rasio * 100)}%`}
                  sublabel="Target"
                  color={colors.success}
                  colorEnd={colors.primary}
                />
                <View style={styles.flex}>
                  <View style={styles.progressLabelRow}>
                    <Ionicons name="trending-up" size={fontSize.md} color={colors.success} />
                    <Text style={styles.progressLabel}>Progres Mingguan</Text>
                  </View>
                  <Text style={styles.progressTitle}>
                    {s.minggu.selesai}/{s.minggu.total} Tugas Selesai
                  </Text>
                  <Text style={styles.progressText}>{kalimatMotivasi(s.minggu.selesai, s.minggu.total)}</Text>
                </View>
              </View>

              {/* Ringkasan 2x2 */}
              <View style={styles.gridRow}>
                <StatCard variant="danger" icon="alert" badge="Segera" value={s.mendesak.length} label="Tugas Mendesak" style={styles.flex} />
                <StatCard variant="primary" icon="clipboard-outline" badge="Aktif" value={s.totalAktif} label="Total Tugas" style={styles.flex} />
              </View>
              <View style={styles.gridRow}>
                <StatCard variant="success" icon="checkmark-circle-outline" badge="Selesai" value={s.totalSelesai} label="Tugas Selesai" style={styles.flex} />
                <StatCard variant="neutral" icon="school-outline" badge="Hari Ini" value={s.jadwal.length} label="Kelas Aktif" style={styles.flex} />
              </View>

              {/* Tugas Mendesak */}
              <SectionHeader title="Tugas Mendesak" count={s.mendesak.length} onAction={keTugas} style={styles.section} />
              {s.mendesak.length ? (
                <View style={styles.list}>
                  {s.mendesak.map((t) => (
                    <TaskCard
                      key={t.id}
                      subject={t.kelas?.nama_mapel}
                      kelas={t.kelas?.rombel}
                      title={t.judul}
                      dueAt={t.deadline}
                      teacher={t.kelas?.guru?.nama_lengkap}
                      info={t.keterangan}
                      onDetail={keTugas}
                      onSubmit={keTugas}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState icon="happy-outline" text="Tidak ada tugas mendesak. Kamu aman untuk hari ini dan besok!" />
              )}

              {/* Jadwal Hari Ini */}
              <SectionHeader title="Jadwal Hari Ini" chip={{ icon: 'calendar-outline', label: formatTodayChip() }} style={styles.section} />
              {s.jadwal.length ? (
                <View style={styles.list}>
                  {s.jadwal.map((j) => (
                    <ScheduleCard
                      key={j.id}
                      layout="student"
                      status={j.status}
                      start={j.jam_mulai}
                      end={j.jam_selesai}
                      title={[j.kelas?.nama_mapel, j.kelas?.rombel].filter(Boolean).join(' - ')}
                      location={j.ruangan}
                      teacher={j.kelas?.guru?.nama_lengkap}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState icon="cafe-outline" text="Tidak ada jadwal pelajaran hari ini." />
              )}
              {/* "Lihat Semua" diletakkan di bawah daftar: di header tidak muat bersama chip tanggal */}
              <Pressable onPress={keJadwal} accessibilityRole="link" hitSlop={8} style={({ pressed }) => [styles.footerLink, pressed && { opacity: 0.7 }]}>
                <Text style={styles.footerLinkText}>Lihat Semua Jadwal</Text>
                <Ionicons name="chevron-forward" size={fontSize.md} color={colors.primary} />
              </Pressable>
            </>
          ) : (
            <Text style={styles.retryHint}>Tarik layar ke bawah untuk mencoba lagi.</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const GUTTER = spacing.md + spacing.xs;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: GUTTER, paddingBottom: spacing.xl },

  greeting: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, marginBottom: spacing.lg },
  avatarLarge: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.siswa, alignItems: 'center', justifyContent: 'center' },
  onlineDot: { position: 'absolute', right: 2, bottom: 2, width: 16, height: 16, borderRadius: radius.pill, backgroundColor: colors.success, borderWidth: 3, borderColor: colors.bg },
  hi: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.heavy },
  kelasChip: { marginTop: spacing.sm },

  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: GUTTER,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  progressGlow: { position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  progressLabel: { color: colors.success, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  progressTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: spacing.xs },
  progressText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19, marginTop: spacing.xs },

  gridRow: { flexDirection: 'row', gap: spacing.sm + spacing.xs, marginBottom: spacing.sm + spacing.xs },

  section: { marginTop: spacing.lg },
  list: { gap: spacing.md },
  footerLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: spacing.xs, marginTop: spacing.md },
  footerLinkText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  retryHint: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center', marginTop: spacing.lg },
});
