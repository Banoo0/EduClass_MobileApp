import { FloatingSafeAreaView } from '../../components/FloatingTabBar';
import { useAppTheme } from '../../context/ThemeContext';
import AppBackdrop from '../../components/AppBackdrop';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AppInput from '../../components/AppInput';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../components/DashboardHeader';
import AppButton from '../../components/AppButton';
import FormAlert from '../../components/FormAlert';
import { useAuth } from '../../context/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '../../core/theme';
import { fetchStudentAssignmentDetails, submitAssignment, validDriveUrl } from '../../services/assignmentService';

export default function UploadFileScreen({ route, navigation }) {
  const { colors, mode: appThemeMode } = useAppTheme();
  const styles = make_styles(colors);

  const { user, profile } = useAuth(); const studentId = user?.uid || profile?.id;
  const [assignment, setAssignment] = useState(null); const [url, setUrl] = useState(''); const [note, setNote] = useState(''); const [loading, setLoading] = useState(true); const [sending, setSending] = useState(false); const [error, setError] = useState('');
  const load = useCallback(async () => { const res = await fetchStudentAssignmentDetails(route.params.assignmentId, studentId); setAssignment(res.data); setError(res.error?.message || ''); setLoading(false); }, [route.params.assignmentId, studentId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const openLink = async () => { try { if (!validDriveUrl(url)) throw new Error('Link tidak valid.'); await Linking.openURL(url.trim()); } catch (e) { setError(e.message); } };
  const send = async () => { if (!validDriveUrl(url) || !assignment || sending) return; setSending(true); setError(''); const result = await submitAssignment({ assignment, studentId, student: profile, url, note }); setSending(false); if (result.error) setError(result.error.message); else navigation.goBack(); };
  return <FloatingSafeAreaView style={styles.safe} edges={['top']}><AppBackdrop />
    <DashboardHeader variant="siswa" title="Kumpulkan Tugas" onAvatarPress={() => navigation.getParent()?.navigate('Profil')} />
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={18} color={colors.primary} /><Text style={styles.backText}>Kembali ke detail</Text></Pressable>
      {loading ? <ActivityIndicator color={colors.primary} /> : <View style={styles.card}>
        <Text style={styles.heading}>{assignment?.judul || 'Tugas'}</Text><Text style={styles.help}>Pastikan guru memiliki akses lihat file Google Drive sebelum mengirim link.</Text>
        <AppInput label="Link Google Drive" required value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://drive.google.com/..." editable={!sending} />
        <AppButton title="Periksa link" variant="outline" onPress={openLink} disabled={!validDriveUrl(url)} />
        <AppInput label="Catatan tambahan (opsional)" value={note} onChangeText={setNote} multiline maxLength={1000} editable={!sending} />
        <FormAlert message={error} />
        <AppButton title="Kirim pengumpulan" icon="send-outline" variant="success" onPress={send} loading={sending} disabled={!assignment || !validDriveUrl(url) || sending} />
      </View>}
    </ScrollView>
  </FloatingSafeAreaView>;
}
const make_styles = (colors) => (StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg }, content: { padding: spacing.md, paddingBottom: 36 }, back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }, backText: { color: colors.primary, fontWeight: fontWeight.semibold }, card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }, heading: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }, help: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.xs }, picker: { minHeight: 180, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: spacing.md, marginVertical: spacing.lg, backgroundColor: colors.primarySoft }, pickTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, textAlign: 'center', marginTop: spacing.sm }, pickHint: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.xs } }));
