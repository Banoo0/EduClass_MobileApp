import { FloatingSafeAreaView } from '../../components/FloatingTabBar';
import { useAppTheme } from '../../context/ThemeContext';
import AppBackdrop from '../../components/AppBackdrop';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../components/DashboardHeader';
import AppButton from '../../components/AppButton';
import FormAlert from '../../components/FormAlert';
import { colors, fontSize, fontWeight, radius, spacing } from '../../core/theme';
import { fetchStudentAssignmentDetails, validDriveUrl } from '../../services/assignmentService';

function formatStatus(status) {
  switch (status) {
    case 'dinilai':
      return 'Sudah dinilai';
    case 'perlu_revisi':
      return 'Perlu revisi';
    case 'dikumpulkan':
      return 'Sudah dikumpulkan';
    case 'terlambat':
      return 'Terlambat';
    default:
      return status || 'Belum dikumpulkan';
  }
}

function getStatusTone(status, colors) {
  switch (status) {
    case 'dinilai':
      return { bg: colors.successSoft, text: colors.success, icon: 'checkmark-circle' };
    case 'perlu_revisi':
      return { bg: colors.warningSoft, text: colors.warning, icon: 'refresh-circle' };
    case 'dikumpulkan':
      return { bg: colors.primarySoft, text: colors.primary, icon: 'cloud-done' };
    case 'terlambat':
      return { bg: colors.dangerSoft, text: colors.danger, icon: 'alert-circle' };
    default:
      return { bg: colors.cardAlt, text: colors.textMuted, icon: 'hourglass-outline' };
  }
}

export default function DetailTugasScreen({ route, navigation }) {
  const { colors, mode: appThemeMode } = useAppTheme();
  const styles = make_styles(colors);

  const { assignmentId } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [item, setItem] = useState(null);

  const { user, profile } = useAuth();
  const studentId = user?.uid || profile?.id;

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        if (!assignmentId || !studentId) throw new Error('Identitas siswa atau tugas belum tersedia.');
        const result = await fetchStudentAssignmentDetails(assignmentId, studentId);
        if (!active) return;
        setItem(result.data || null);
        setError(result.error?.message || '');
      } catch (e) {
        if (active) {
          setItem(null);
          setError(e.message || 'Gagal memuat tugas.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [assignmentId, studentId]));

  const openLink = async (url) => {
    try {
      if (!validDriveUrl(url)) throw new Error('Link Google Drive tidak valid atau belum tersedia.');
      await Linking.openURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  const due = item?.deadline ? (() => {
    const date = new Date(item.deadline);
    if (Number.isNaN(date.getTime())) return null;
    return {
      label: date.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }),
      expired: date.getTime() < Date.now(),
    };
  })() : null;

  const submission = item?.submission || null;
  const statusTone = getStatusTone(submission?.status, colors);
  const statusLabel = formatStatus(submission?.status);
  const scoreText = submission?.nilai != null ? String(submission.nilai) : '-';

  const canSubmit = useMemo(() => {
    if (!item) return false;
    const deadlineMs = item.deadline ? new Date(item.deadline).getTime() : 0;
    return ((!submission && Date.now() <= deadlineMs) || submission?.status === 'perlu_revisi');
  }, [item, submission]);

  return (
    <FloatingSafeAreaView style={styles.safe} edges={['top']}><AppBackdrop />
      <DashboardHeader variant="siswa" title="Detail Tugas" onAvatarPress={() => navigation.getParent()?.navigate('Profil')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color={colors.primary} />
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>

        <FormAlert message={error} />

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : item ? (
          <View style={styles.card}>
            <Text style={styles.class}>{[item.class?.nama_mapel || item.class_nama, item.class?.rombel].filter(Boolean).join(' • ')}</Text>

            <View style={styles.titleRow}>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>{item.judul}</Text>
              </View>
              <View style={styles.scoreHero}>
                <Text style={styles.scoreHeroLabel}>Nilai</Text>
                <Text style={[styles.scoreHeroValue, submission?.nilai == null && styles.scoreHeroEmpty]}>{scoreText}</Text>
              </View>
            </View>

            <View style={styles.metaWrap}>
              <View style={[styles.deadlineChip, due?.expired && styles.deadlineChipDanger]}>
                <Ionicons name="time-outline" size={16} color={due?.expired ? colors.danger : colors.warning} />
                <Text style={[styles.deadlineText, due?.expired && styles.deadlineTextDanger]}>{due?.label || item.deadline}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.label}>Petunjuk tugas</Text>
            <Text style={styles.description}>{item.deskripsi || 'Tidak ada deskripsi.'}</Text>

            {validDriveUrl(item.attachment_url) ? (
              <AppButton title="Buka soal Google Drive" variant="outline" icon="open-outline" onPress={() => openLink(item.attachment_url)} style={styles.inlineButton} />
            ) : null}

            <View style={styles.divider} />

            <View style={styles.sectionHeader}>
              <Text style={styles.label}>Pengumpulan</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusTone.bg }]}>
                <Ionicons name={statusTone.icon} size={14} color={statusTone.text} />
                <Text style={[styles.statusBadgeText, { color: statusTone.text }]}>{statusLabel}</Text>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={styles.infoValue}>{statusLabel}</Text>
              </View>
            </View>

            {submission ? (
              <>
                {validDriveUrl(submission.submission_url) ? (
                  <Pressable style={styles.linkCard} onPress={() => openLink(submission.submission_url)}>
                    <View style={styles.linkIconWrap}>
                      <Ionicons name="link-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.linkTextWrap}>
                      <Text style={styles.linkTitle}>Jawaban kamu</Text>
                      
                    </View>
                    <Ionicons name="open-outline" size={18} color={colors.primary} />
                  </Pressable>
                ) : (
                  <Text style={styles.description}>Link jawaban belum tersedia.</Text>
                )}

                {submission.student_note ? (
                  <View style={styles.noteCard}>
                    <Text style={styles.noteLabel}>Catatan siswa</Text>
                    <Text style={styles.noteText}>{submission.student_note}</Text>
                  </View>
                ) : null}

                {submission.catatan_guru ? (
                  <View style={[styles.noteCard, styles.teacherNoteCard]}>
                    <Text style={styles.noteLabel}>Catatan guru</Text>
                    <Text style={styles.noteText}>{submission.catatan_guru}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.description}>Belum ada link yang dikumpulkan.</Text>
            )}

            {canSubmit ? (
              <AppButton
                title={submission ? 'Kirim revisi' : 'Kumpulkan tugas'}
                icon="link-outline"
                variant="success"
                onPress={() => navigation.navigate('UploadTugas', { assignmentId: item.id })}
                style={styles.button}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </FloatingSafeAreaView>
  );
}

const make_styles = (colors) => (StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: 36 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  backText: { color: colors.primary, fontWeight: fontWeight.semibold },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  class: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  titleWrap: { flex: 1, minWidth: 180 },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  scoreHero: { minWidth: 96, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: 'rgba(22,163,74,0.18)', alignItems: 'center' },
  scoreHeroLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 4 },
  scoreHeroValue: { color: colors.success, fontSize: fontSize.xl, fontWeight: fontWeight.heavy },
  scoreHeroEmpty: { color: colors.textMuted },
  metaWrap: { marginTop: spacing.md },
  deadlineChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.warningSoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  deadlineChipDanger: { backgroundColor: colors.dangerSoft },
  deadlineText: { color: colors.warning, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  deadlineTextDanger: { color: colors.danger },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.sm },
  label: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: spacing.xs },
  description: { color: colors.textMuted, fontSize: fontSize.md, lineHeight: 22, marginBottom: 4 },
  inlineButton: { marginTop: spacing.md },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  statusBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  summaryGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.md },
  infoCard: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  infoLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 6 },
  infoValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.cardAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  linkIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  linkTextWrap: { flex: 1 },
  linkTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  linkSubtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  noteCard: { backgroundColor: colors.cardAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  teacherNoteCard: { backgroundColor: 'rgba(22,163,74,0.08)', borderColor: 'rgba(22,163,74,0.18)' },
  noteLabel: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginBottom: 6 },
  noteText: { color: colors.textMuted, fontSize: fontSize.md, lineHeight: 22 },
  button: { marginTop: spacing.lg },
}));
