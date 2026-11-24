import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../components/DashboardHeader';
import AppButton from '../../components/AppButton';
import FormAlert from '../../components/FormAlert';
import { useAuth } from '../../context/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '../../core/theme';
import { fetchStudentAssignmentDetails, submitAssignment } from '../../services/assignmentService';

export default function UploadFileScreen({ route, navigation }) {
  const { user, profile } = useAuth(); const studentId = user?.uid || profile?.id;
  const [assignment, setAssignment] = useState(null); const [file, setFile] = useState(null); const [loading, setLoading] = useState(true); const [sending, setSending] = useState(false); const [error, setError] = useState('');
  const load = useCallback(async () => { const res = await fetchStudentAssignmentDetails(route.params.assignmentId, studentId); setAssignment(res.data); setError(res.error?.message || ''); setLoading(false); }, [route.params.assignmentId, studentId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const pickFile = async () => { const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false }); if (!result.canceled) { setFile(result.assets[0]); setError(''); } };
  const send = async () => { if (!file || !assignment) { setError('Pilih berkas tugas terlebih dahulu.'); return; } setSending(true); setError(''); const result = await submitAssignment({ assignment, studentId, student: profile, file }); setSending(false); if (result.error) setError(result.error.message); else navigation.goBack(); };
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <DashboardHeader variant="siswa" title="Kumpulkan Tugas" onAvatarPress={() => navigation.getParent()?.navigate('Profil')} />
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={18} color={colors.primary} /><Text style={styles.backText}>Kembali ke detail</Text></Pressable>
      {loading ? <ActivityIndicator color={colors.primary} /> : <View style={styles.card}>
        <Text style={styles.heading}>{assignment?.judul || 'Tugas'}</Text><Text style={styles.help}>Pilih satu berkas untuk dikumpulkan. Ukuran maksimal 10 MB.</Text>
        <Pressable style={styles.picker} onPress={pickFile}><Ionicons name="cloud-upload-outline" size={27} color={colors.primary} /><Text style={styles.pickTitle}>{file ? file.name : 'Pilih berkas'}</Text><Text style={styles.pickHint}>{file ? `${file.mimeType || 'File'}${file.size ? ` • ${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}` : 'PDF, dokumen, atau gambar'}</Text></Pressable>
        <FormAlert message={error} />
        <AppButton title="Kirim pengumpulan" icon="send-outline" variant="success" onPress={send} loading={sending} disabled={!file || sending} />
      </View>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg }, content: { padding: spacing.md, paddingBottom: 36 }, back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }, backText: { color: colors.primary, fontWeight: fontWeight.semibold }, card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }, heading: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }, help: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.xs }, picker: { minHeight: 180, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: spacing.md, marginVertical: spacing.lg, backgroundColor: colors.primarySoft }, pickTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, textAlign: 'center', marginTop: spacing.sm }, pickHint: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.xs } });
