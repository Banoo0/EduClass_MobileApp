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
import { fetchAssignmentSubmissions, getAssignmentFileUrl, gradeSubmission } from '../../services/assignmentService';

export default function ReviewSubmissionsScreen({ route, navigation }) {
  const { profile } = useAuth(); const assignment = route.params.assignment;
  const [rows, setRows] = useState([]); const [grades, setGrades] = useState({}); const [notes, setNotes] = useState({}); const [loading, setLoading] = useState(true); const [busyId, setBusyId] = useState(null); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); const result = await fetchAssignmentSubmissions(assignment.id); setRows(result.data || []); setError(result.error?.message || ''); setLoading(false); }, [assignment.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const openFile = async (item) => { const result = await getAssignmentFileUrl(item.file_path); if (result.error) setError(result.error.message); else Linking.openURL(result.data); };
  const save = async (item, status) => { setBusyId(item.id); setError(''); const res = await gradeSubmission({ submissionId: item.id, nilai: grades[item.id] ?? (item.nilai == null ? '' : String(item.nilai)), catatan: notes[item.id] ?? item.catatan_guru ?? '', status }); setBusyId(null); if (res.error) setError(res.error.message); else { setRows((old) => old.map((row) => row.id === item.id ? { ...row, status: status || (grades[item.id] ? 'dinilai' : 'perlu_revisi'), nilai: grades[item.id] ? Number(grades[item.id]) : row.nilai, catatan_guru: notes[item.id] ?? row.catatan_guru } : row)); } };
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <DashboardHeader variant="guru" title="Pengumpulan" onAvatarPress={() => navigation.getParent()?.navigate('Profil')} />
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={18} color={colors.primary} /><Text style={styles.backText}>Kembali ke tugas</Text></Pressable>
      <Text style={styles.heading}>{assignment.judul}</Text><Text style={styles.subtitle}>{[assignment.class?.nama_mapel || assignment.class_nama, assignment.class?.rombel].filter(Boolean).join(' • ')}</Text>
      <FormAlert message={error} />
      {loading ? <ActivityIndicator color={colors.primary} /> : rows.length ? rows.map((item) => <View key={item.id} style={styles.card}>
        <View style={styles.studentRow}><View style={styles.avatar}><Ionicons name="person-outline" size={18} color={colors.primary} /></View><View style={styles.studentInfo}><Text style={styles.name}>{item.student_nama || 'Siswa'}</Text><Text style={styles.status}>{item.status || 'dikumpulkan'}{item.nilai != null ? ` • Nilai ${item.nilai}` : ''}</Text></View></View>
        <Pressable style={styles.file} onPress={() => openFile(item)}><Ionicons name="document-attach-outline" size={18} color={colors.primary} /><Text style={styles.fileName} numberOfLines={1}>{item.file_name || 'Buka berkas siswa'}</Text><Ionicons name="open-outline" size={16} color={colors.primary} /></Pressable>
        <View style={styles.inputRow}><View style={styles.grade}><AppInput label="Nilai" value={grades[item.id] ?? (item.nilai == null ? '' : String(item.nilai))} onChangeText={(v) => setGrades((old) => ({ ...old, [item.id]: v.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" placeholder="0–100" /></View><View style={styles.flex}><AppInput label="Catatan guru" value={notes[item.id] ?? item.catatan_guru ?? ''} onChangeText={(v) => setNotes((old) => ({ ...old, [item.id]: v }))} placeholder="Catatan atau revisi" /></View></View>
        <View style={styles.actions}><AppButton title="Perlu revisi" variant="outline" loading={busyId === item.id} disabled={!!busyId} onPress={() => save(item, 'perlu_revisi')} style={styles.flex} /><AppButton title="Simpan nilai" icon="checkmark-circle-outline" variant="success" loading={busyId === item.id} disabled={!!busyId} onPress={() => save(item, 'dinilai')} style={styles.flex} /></View>
      </View>) : <EmptyState icon="cloud-done-outline" text="Belum ada siswa yang mengumpulkan tugas ini." />}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg }, content: { padding: spacing.md, paddingBottom: 40 }, back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }, backText: { color: colors.primary, fontWeight: fontWeight.semibold }, heading: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }, subtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, marginBottom: spacing.md }, card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }, studentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, avatar: { width: 38, height: 38, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }, studentInfo: { flex: 1 }, name: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold }, status: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 3 }, file: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.cardAlt, borderRadius: radius.md, marginVertical: spacing.md }, fileName: { color: colors.primary, flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }, inputRow: { flexDirection: 'row', gap: spacing.sm }, grade: { width: 100 }, flex: { flex: 1 }, actions: { flexDirection: 'row', gap: spacing.sm } });
