import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import AppButton from '../../components/AppButton.js';
import Chip from '../../components/Chip';
import DashboardHeader from '../../components/DashboardHeader';
import EmptyState from '../../components/EmptyState';
import FormAlert from '../../components/FormAlert';
import ScheduleCard from '../../components/ScheduleCard';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import SubmissionCard from '../../components/SubmissionCard';
import { useAuth } from '../../context/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '../../core/theme';
import { getTeacherDashboard } from '../../services/dashboardService';
import { formatMulaiDalam, formatSisaWaktu, formatTanggalPanjang, getScheduleStatus, isThisWeek } from '../../utils/dateHelper';

const MAKS_TUGAS = 3;

// Alert.alert tidak melakukan apa-apa di react-native-web, jadi di browser memakai window.alert
function fiturSegeraHadir(nama) {
  const pesan = `${nama} sedang dikembangkan.`;
  if (Platform.OS === 'web') window.alert(`Fitur segera hadir\n\n${pesan}`);
  else Alert.alert('Fitur segera hadir', pesan);
}

const jumlahBelumDinilai = (t) => (t.pengumpulan ?? []).filter((p) => p.nilai == null).length;

// Semua angka Beranda guru dihitung dari data mentah dan waktu sekarang.
function buildSummary(data, now) {
  const tugas = data?.tugas ?? [];
  const pengumpulan = tugas.flatMap((t) => t.pengumpulan ?? []);
  // Tugas yang masih perlu dipantau: tenggat belum lewat atau masih ada yang belum dinilai
  const dipantau = tugas
    .filter((t) => (t.deadline && dayjs(t.deadline).isAfter(now)) || jumlahBelumDinilai(t) > 0)
    .sort((a, b) => dayjs(a.deadline).diff(dayjs(b.deadline)));
  const jadwal = [...(data?.jadwal ?? [])]
    .sort((a, b) => String(a.jam_mulai).localeCompare(String(b.jam_mulai)))
    .map((j) => ({ ...j, status: getScheduleStatus(j.jam_mulai, j.jam_selesai, now) }));

  return {
    mapel: [...new Set((data?.kelas ?? []).map((k) => k.nama_mapel).filter(Boolean))].join(' & '),
    terkumpul: pengumpulan.length,
    terkumpulMingguIni: pengumpulan.filter((p) => isThisWeek(p.submitted_at, now)).length,
    belumDinilai: pengumpulan.filter((p) => p.nilai == null).length,
    dipantau,
    jadwal,
  };
}

function catatanWaktu(j, now) {
  if (j.status === 'active') return formatSisaWaktu(j.jam_selesai, now);
  if (j.status === 'upcoming') return formatMulaiDalam(j.jam_mulai, now);
  return undefined;
}

function TombolSesi({ status }) {
  if (status === 'active') {
    return (
      <>
        <AppButton title="Mulai Presensi" icon="people-outline" variant="success" onPress={() => fiturSegeraHadir('Presensi')} style={styles.sessionButton} />
        <AppButton title="Materi Tayang" icon="easel-outline" variant="outline" onPress={() => fiturSegeraHadir('Materi tayang')} style={[styles.sessionButton, styles.secondaryButton]} />
      </>
    );
  }
  if (status === 'upcoming') {
    return (
      <AppButton title="Lihat RPP & Modul" icon="book-outline" variant="outline" onPress={() => fiturSegeraHadir('RPP & Modul')} style={[styles.secondaryButton, styles.rppButton]} />
    );
  }
  return null;
}

export default function BerandaScreen({ navigation }) {
  const { profile } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: result, error: err } = await getTeacherDashboard();
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

  const now = dayjs();
  const s = buildSummary(data, now);
  const nama = profile?.nama_lengkap?.trim() || 'Guru';
  const infoGuru = [s.mapel ? `Guru ${s.mapel}` : null, profile?.nomor_induk ? `NIP: ${profile.nomor_induk}` : null].filter(Boolean).join(' • ');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DashboardHeader variant="guru" title="Beranda" onAvatarPress={() => navigation.navigate('Profil')} />

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
          {/* Kartu profil */}
          <View style={styles.profileCard}>
            <View style={styles.profileGlow} />
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Ionicons name="person-outline" size={36} color={colors.bg} />
              </View>
              <View style={styles.flex}>
                <Chip label="Aktif Mengajar" tone="success" dot />
                <Text style={styles.hi} numberOfLines={2}>
                  Hi, {nama}!
                </Text>
                {infoGuru ? (
                  <Text style={styles.info} numberOfLines={2}>
                    {infoGuru}
                  </Text>
                ) : null}
              </View>
            </View>
            {/* flexWrap: berdampingan di HP lebar, bertumpuk di HP sempit */}
            <View style={styles.quickActions}>
              <AppButton title="Buat Tugas Cepat" icon="add-circle-outline" onPress={() => navigation.navigate('BuatTugas')} style={styles.quickButton} />
              <AppButton title="Buka Kelas" icon="enter-outline" variant="outline" onPress={() => navigation.navigate('KelolaKelas')} style={[styles.quickButton, styles.secondaryButton]} />
            </View>
          </View>

          <FormAlert message={error} />

          {data ? (
            <>
              {/* Ringkasan */}
              <View style={styles.statRow}>
                <StatCard
                  variant="success"
                  icon="checkmark-circle-outline"
                  labelPosition="top"
                  label="Tugas Selesai"
                  value={s.terkumpul}
                  extra={s.terkumpulMingguIni ? `+${s.terkumpulMingguIni} mgg ini` : undefined}
                  extraColored
                  style={styles.flex}
                />
                <StatCard
                  variant="danger"
                  icon="hourglass-outline"
                  labelPosition="top"
                  label="Belum Dinilai"
                  value={s.belumDinilai}
                  valueColored
                  extra="tugas prioritas"
                  style={styles.flex}
                />
              </View>

              {/* Jadwal Mengajar Hari Ini */}
              <SectionHeader
                title="Jadwal Mengajar Hari Ini"
                subtitle={formatTanggalPanjang(now)}
                chip={{ label: `${s.jadwal.length} Sesi Hari Ini` }}
                style={styles.section}
              />
              {s.jadwal.length ? (
                <View style={styles.list}>
                  {s.jadwal.map((j) => (
                    <ScheduleCard
                      key={j.id}
                      layout="teacher"
                      status={j.status}
                      start={j.jam_mulai}
                      end={j.jam_selesai}
                      timeNote={catatanWaktu(j, now)}
                      title={[j.kelas?.nama_mapel, j.kelas?.rombel].filter(Boolean).join(' ')}
                      location={j.ruangan}
                    >
                      {j.status === 'done' ? null : <TombolSesi status={j.status} />}
                    </ScheduleCard>
                  ))}
                </View>
              ) : (
                <EmptyState icon="cafe-outline" text="Tidak ada jadwal mengajar hari ini." />
              )}

              {/* Tugas & Pengumpulan */}
              <SectionHeader
                title="Tugas & Pengumpulan"
                actionLabel={`Lihat Semua (${s.dipantau.length})`}
                onAction={() => fiturSegeraHadir('Daftar semua tugas')}
                style={styles.section}
              />
              {s.dipantau.length ? (
                <View style={styles.list}>
                  {s.dipantau.slice(0, MAKS_TUGAS).map((t) => (
                    <SubmissionCard
                      key={t.id}
                      subject={t.kelas?.nama_mapel}
                      kelas={t.kelas?.rombel}
                      title={t.judul}
                      dueAt={t.deadline}
                      submitted={(t.pengumpulan ?? []).length}
                      total={t.kelas?.jumlah_siswa ?? 0}
                      ungraded={jumlahBelumDinilai(t)}
                      onPress={() => fiturSegeraHadir('Pemeriksaan pengumpulan')}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState icon="checkmark-done-outline" text="Belum ada tugas yang perlu dipantau. Buat tugas baru lewat tombol + di bawah." />
              )}
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
  scroll: { paddingHorizontal: GUTTER, paddingTop: spacing.sm, paddingBottom: spacing.xl },

  profileCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: GUTTER, marginBottom: spacing.md, overflow: 'hidden' },
  profileGlow: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.guru, alignItems: 'center', justifyContent: 'center' },
  hi: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy, marginTop: spacing.sm },
  info: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19, marginTop: spacing.xs },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + spacing.xs, marginTop: GUTTER },
  quickButton: { flexGrow: 1, flexBasis: 150, minHeight: 46 },
  secondaryButton: { backgroundColor: colors.cardAlt, borderColor: colors.cardAlt },

  statRow: { flexDirection: 'row', gap: spacing.sm + spacing.xs },

  section: { marginTop: spacing.lg },
  list: { gap: spacing.md },
  sessionButton: { flexGrow: 1, flexBasis: 140, minHeight: 44 },
  rppButton: { minHeight: 44, marginLeft: 'auto' },
  retryHint: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center', marginTop: spacing.lg },
});
