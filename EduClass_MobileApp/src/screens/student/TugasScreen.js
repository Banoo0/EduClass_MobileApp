import { FloatingSafeAreaView } from '../../components/FloatingTabBar';
import { useAppTheme } from '../../context/ThemeContext';
import AppBackdrop from '../../components/AppBackdrop';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import DashboardHeader from '../../components/DashboardHeader';
import EmptyState from '../../components/EmptyState';
import FormAlert from '../../components/FormAlert';
import TaskCard from '../../components/TaskCard';
import { useAuth } from '../../context/AuthContext';
import { colors, fontSize, fontWeight, spacing } from '../../core/theme';
import { fetchStudentAssignments } from '../../services/assignmentService';

export default function TugasScreen({ navigation }) {
  const { colors, mode: appThemeMode } = useAppTheme();
  const styles = make_styles(colors);

  const { user, profile } = useAuth();
  const studentId = user?.uid || profile?.id;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    const result = await fetchStudentAssignments(studentId);
    setRows(result.data || []);
    setError(result.error?.message || '');
    setLoading(false); setRefreshing(false);
  }, [studentId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return <FloatingSafeAreaView style={styles.safe} edges={['top']}><AppBackdrop />
    <DashboardHeader variant="siswa" title="Tugas" onAvatarPress={() => navigation.getParent()?.navigate('Profil')} />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}>
      
      
      <FormAlert message={error} />
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : rows.length ? rows.map((item) => <TaskCard key={item.id} subject={item.class?.nama_mapel || item.class_nama} kelas={item.class?.rombel} title={item.judul} dueAt={item.deadline} teacher={item.teacher_nama} info={item.submission ? ({dikumpulkan:'Terkumpul',dinilai:'Dinilai',perlu_revisi:'Perlu revisi'}[item.submission.status] || item.submission.status) : 'Belum dikumpulkan'} infoIcon="cloud-upload-outline" onDetail={() => navigation.navigate('DetailTugas', { assignmentId: item.id })} onSubmit={!item.submission || item.submission.status === 'perlu_revisi' ? () => navigation.navigate('UploadTugas', { assignmentId: item.id }) : undefined} style={styles.card} />) : <EmptyState icon="document-text-outline" text="Belum ada tugas" />}
    </ScrollView>
  </FloatingSafeAreaView>;
}
const make_styles = (colors) => (StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg }, content: { padding: spacing.md, paddingBottom: 36 }, heading: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }, subtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, marginBottom: spacing.md }, loading: { marginTop: 30 }, card: { marginBottom: spacing.md } }));
