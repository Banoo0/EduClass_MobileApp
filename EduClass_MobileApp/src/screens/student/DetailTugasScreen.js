import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../components/DashboardHeader';
import AppButton from '../../components/AppButton';
import FormAlert from '../../components/FormAlert';
import { useAuth } from '../../context/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '../../core/theme';
import { fetchStudentAssignmentDetails } from '../../services/assignmentService';
import { formatDeadline } from '../../utils/dateHelper';

export default function DetailTugasScreen({ route, navigation }) {
  const { user, profile } = useAuth();
  const [item, setItem] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); const result = await fetchStudentAssignmentDetails(route.params.assignmentId, user?.uid || profile?.id); setItem(result.data); setError(result.error?.message || ''); setLoading(false); }, [route.params.assignmentId, user?.uid, profile?.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const due = item ? formatDeadline(item.deadline) : null;
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <DashboardHeader variant="siswa" title="Detail Tugas" onAvatarPress={() => navigation.getParent()?.navigate('Profil')} />
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={18} color={colors.primary} /><Text style={styles.backText}>Kembali ke daftar tugas</Text></Pressable>
      <FormAlert message={error} />
      {loading ? <ActivityIndicator color={colors.primary} /> : item ? <View style={styles.card}>
        <Text style={styles.class}>{[item.class?.nama_mapel || item.class_nama, item.class?.rombel].filter(Boolean).join(' • ')}</Text>
        <Text style={styles.title}>{item.judul}</Text>
        <View style={styles.meta}><Ionicons name="time-outline" size={17} color={colors.warning} /><Text style={styles.metaText}>{due?.label || item.deadline}</Text></View>
        <View style={styles.divider} />
        <Text style={styles.label}>Petunjuk tugas</Text><Text style={styles.description}>{item.deskripsi || 'Tidak ada deskripsi.'}</Text>
        <View style={styles.divider} />
        <Text style={styles.label}>Pengumpulan kamu</Text>
        {item.submission ? <View><Text style={styles.description}>Status: {item.submission.status}</Text><Text style={styles.description}>Berkas: {item.submission.file_name || '—'}</Text>{item.submission.nilai != null ? <Text style={styles.description}>Nilai: {item.submission.nilai}</Text> : null}{item.submission.catatan_guru ? <Text style={styles.description}>Catatan guru: {item.submission.catatan_guru}</Text> : null}</View> : <Text style={styles.description}>Belum ada berkas yang dikumpulkan.</Text>}
        {(!item.submission || item.submission.status === 'perlu_revisi') ? <AppButton title={item.submission ? 'Kirim revisi' : 'Kumpulkan tugas'} icon="cloud-upload-outline" variant="success" onPress={() => navigation.navigate('UploadTugas', { assignmentId: item.id })} style={styles.button} /> : null}
      </View> : null}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg }, content: { padding: spacing.md, paddingBottom: 36 }, back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }, backText: { color: colors.primary, fontWeight: fontWeight.semibold }, card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md }, class: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }, title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginTop: spacing.sm }, meta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing.md }, metaText: { color: colors.textMuted, fontSize: fontSize.sm }, divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md }, label: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: spacing.xs }, description: { color: colors.textMuted, fontSize: fontSize.md, lineHeight: 22, marginBottom: 4 }, button: { marginTop: spacing.lg } });
