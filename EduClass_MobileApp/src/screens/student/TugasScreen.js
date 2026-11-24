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
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <DashboardHeader variant="siswa" title="Tugas" onAvatarPress={() => navigation.getParent()?.navigate('Profil')} />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}>
      <Text style={styles.heading}>Tugas kelas</Text>
      <Text style={styles.subtitle}>Tugas terbit dari kelas yang kamu ikuti.</Text>
      <FormAlert message={error} />
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : rows.length ? rows.map((item) => <TaskCard key={item.id} subject={item.class?.nama_mapel || item.class_nama} kelas={item.class?.rombel} title={item.judul} dueAt={item.deadline} teacher={item.teacher_nama} info={item.submission ? `Status: ${item.submission.status}` : 'Belum dikumpulkan'} infoIcon="cloud-upload-outline" onDetail={() => navigation.navigate('DetailTugas', { assignmentId: item.id })} onSubmit={!item.submission || item.submission.status === 'perlu_revisi' ? () => navigation.navigate('UploadTugas', { assignmentId: item.id }) : undefined} style={styles.card} />) : <EmptyState icon="document-text-outline" text="Belum ada tugas yang diterbitkan untuk kelasmu." />}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg }, content: { padding: spacing.md, paddingBottom: 36 }, heading: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }, subtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, marginBottom: spacing.md }, loading: { marginTop: 30 }, card: { marginBottom: spacing.md } });
