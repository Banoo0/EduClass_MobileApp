import { FloatingSafeAreaView } from '../../components/FloatingTabBar';
import { useAppTheme } from '../../context/ThemeContext';
import AppBackdrop from '../../components/AppBackdrop';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../components/DashboardHeader';
import AppButton from '../../components/AppButton';
import AppInput from '../../components/AppInput';
import EmptyState from '../../components/EmptyState';
import FormAlert from '../../components/FormAlert';
import { useAuth } from '../../context/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '../../core/theme';
import { fetchAssignmentSubmissions, validDriveUrl, gradeSubmission } from '../../services/assignmentService';

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
      return status || 'Dikumpulkan';
  }
}

function getStatusTone(status, colors) {
  switch (status) {
    case 'dinilai':
      return { bg: colors.successSoft, text: colors.success };
    case 'perlu_revisi':
      return { bg: colors.warningSoft, text: colors.warning };
    case 'terlambat':
      return { bg: colors.dangerSoft, text: colors.danger };
    default:
      return { bg: colors.primarySoft, text: colors.primary };
  }
}

export default function ReviewSubmissionsScreen({ route, navigation }) {
  const { colors, mode: appThemeMode } = useAppTheme();
  const styles = make_styles(colors);

  const { profile } = useAuth();
  const assignment = route.params.assignment;
  const [rows, setRows] = useState([]);
  const [grades, setGrades] = useState({});
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAssignmentSubmissions(assignment.id);
    setRows(result.data || []);
    setError(result.error?.message || '');
    setLoading(false);
  }, [assignment.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openFile = async (item) => {
    try {
      if (!validDriveUrl(item.submission_url)) throw new Error('Link jawaban belum tersedia atau tidak valid.');
      await Linking.openURL(item.submission_url);
    } catch (e) {
      setError(e.message);
    }
  };

  const save = async (item, status) => {
    setBusyId(item.id);
    setError('');
    const res = await gradeSubmission({
      submissionId: item.id,
      nilai: grades[item.id] ?? (item.nilai == null ? '' : String(item.nilai)),
      catatan: notes[item.id] ?? item.catatan_guru ?? '',
      status,
    });
    if (res.error) {
      setError(res.error.message);
    } else {
      setGrades(old => ({ ...old, [item.id]: undefined }));
      setNotes(old => ({ ...old, [item.id]: undefined }));
      await load();
    }
    setBusyId(null);
  };

  return (
    <FloatingSafeAreaView style={styles.safe} edges={['top']}><AppBackdrop />
      <DashboardHeader variant="guru" title="Pengumpulan" onAvatarPress={() => navigation.getParent()?.navigate('Profil')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color={colors.primary} />
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>

        <Text style={styles.heading}>{assignment.judul}</Text>
        <Text style={styles.subtitle}>{[assignment.class?.nama_mapel || assignment.class_nama, assignment.class?.rombel].filter(Boolean).join(' • ')}</Text>

        <FormAlert message={error} />

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : rows.length ? rows.map((item) => {
          const statusTone = getStatusTone(item.status, colors);
          const gradeValue = grades[item.id] ?? (item.nilai == null ? '' : String(item.nilai));
          const noteValue = notes[item.id] ?? item.catatan_guru ?? '';

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.studentRow}>
                <View style={styles.avatar}><Ionicons name="person-outline" size={18} color={colors.primary} /></View>
                <View style={styles.studentInfo}>
                  <Text style={styles.name}>{item.student_nama || 'Siswa'}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusTone.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusTone.text }]}>{formatStatus(item.status)}</Text>
                  </View>
                </View>
                <View style={styles.scorePill}>
                  <Text style={styles.scorePillLabel}>Nilai</Text>
                  <Text style={styles.scorePillValue}>{item.nilai != null ? item.nilai : '-'}</Text>
                </View>
              </View>

              <Pressable style={styles.file} onPress={() => openFile(item)}>
                <View style={styles.fileLeft}>
                  <View style={styles.fileIcon}><Ionicons name="document-attach-outline" size={18} color={colors.primary} /></View>
                  <View style={styles.fileTextWrap}>
                    <Text style={styles.fileTitle}>{item.submission_url ? 'Jawaban Google Drive' : 'Link jawaban belum tersedia'}</Text>
                    
                  </View>
                </View>
                <Ionicons name="open-outline" size={18} color={colors.primary} />
              </Pressable>

              <View style={styles.metaGrid}>
                <View style={styles.metaCard}>
                  <Text style={styles.metaLabel}>Catatan siswa</Text>
                  <Text style={styles.metaValue}>{item.student_note || '-'}</Text>
                </View>
                <View style={styles.metaCard}>
                  <Text style={styles.metaLabel}>Waktu pengumpulan</Text>
                  <Text style={styles.metaValue}>{item.submitted_at ? new Date(item.submitted_at).toLocaleString('id-ID') : '-'}</Text>
                </View>
              </View>

              <View style={styles.formWrap}>
                <View style={styles.gradeWrap}>
                  <AppInput
                    label="Nilai"
                    value={gradeValue}
                    onChangeText={(v) => setGrades((old) => ({ ...old, [item.id]: v.replace(/[^0-9.]/g, '') }))}
                    keyboardType="decimal-pad"
                    placeholder="0–100"
                  />
                </View>
                <View style={styles.noteWrap}>
                  <AppInput
                    label="Catatan guru"
                    value={noteValue}
                    onChangeText={(v) => setNotes((old) => ({ ...old, [item.id]: v }))}
                    placeholder="Tulis feedback atau revisi untuk siswa"
                    multiline
                  />
                </View>
              </View>

              <View style={styles.actions}>
                <AppButton
                  title="Perlu revisi"
                  variant="outline"
                  loading={busyId === item.id}
                  disabled={!!busyId}
                  onPress={() => save(item, 'perlu_revisi')}
                  style={styles.actionButton}
                />
                <AppButton
                  title="Simpan nilai"
                  icon="checkmark-circle-outline"
                  variant="success"
                  loading={busyId === item.id}
                  disabled={!!busyId}
                  onPress={() => save(item, 'dinilai')}
                  style={styles.actionButton}
                />
              </View>
            </View>
          );
        }) : <EmptyState icon="cloud-done-outline" text="Belum ada pengumpulan" />}
      </ScrollView>
    </FloatingSafeAreaView>
  );
}

const make_styles = (colors) => (StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  backText: { color: colors.primary, fontWeight: fontWeight.semibold },
  heading: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, marginBottom: spacing.md },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  studentInfo: { flex: 1, minWidth: 160 },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  statusBadge: { alignSelf: 'flex-start', marginTop: 6, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  statusBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  scorePill: { minWidth: 88, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  scorePillLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 4 },
  scorePillValue: { color: colors.success, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  file: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.cardAlt, borderRadius: radius.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  fileLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  fileIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  fileTextWrap: { flex: 1 },
  fileTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  fileSubtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  metaGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  metaCard: { flex: 1, minWidth: 220, backgroundColor: colors.cardAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  metaLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 6 },
  metaValue: { color: colors.text, fontSize: fontSize.sm, lineHeight: 20 },
  formWrap: { marginTop: spacing.md },
  gradeWrap: { marginBottom: 4 },
  noteWrap: { marginTop: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actionButton: { flex: 1, minWidth: 220 },
}));
