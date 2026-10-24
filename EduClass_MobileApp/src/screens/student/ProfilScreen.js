import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../../components/AppButton';
import { useAuth } from '../../context/AuthContext';
import { colors, radius } from '../../core/theme';

// Profil siswa sederhana. Dewi dan Sofie bisa mempercantiknya mengikuti mockup Profil Siswa.
export default function ProfilScreen() {
  const { profile, user, signOut } = useAuth();
  const accent = colors.siswa;

  const rows = [
    { icon: 'mail-outline', label: 'Email', value: user?.email },
    { icon: 'card-outline', label: 'NISN', value: profile?.nomor_induk },
    { icon: 'people-outline', label: 'Kelas', value: profile?.rombel },
    { icon: 'business-outline', label: 'Sekolah', value: profile?.school?.nama_sekolah },
  ];

  const confirmLogout = () =>
    Alert.alert('Keluar dari akun?', 'Kamu perlu masuk lagi untuk membuka EduClass.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={[styles.avatar, { backgroundColor: accent }]}>
            <Ionicons name="person" size={40} color="#0E1015" />
          </View>
          <Text style={styles.name}>{profile?.nama_lengkap ?? '-'}</Text>
          <View style={[styles.badge, { borderColor: accent }]}>
            <Text style={[styles.badgeText, { color: accent }]}>Siswa</Text>
          </View>
        </View>

        <View style={styles.card}>
          {rows.map((r, i) => (
            <View key={r.label} style={[styles.row, i > 0 && styles.rowBorder]}>
              <Ionicons name={r.icon} size={18} color={colors.textMuted} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                <Text style={styles.rowValue}>{r.value || 'Belum diisi'}</Text>
              </View>
            </View>
          ))}
        </View>

        <AppButton title="Keluar" variant="danger" icon="log-out-outline" onPress={confirmLogout} style={{ marginTop: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 24 },
  hero: { alignItems: 'center', marginTop: 12, marginBottom: 28 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  name: { color: colors.text, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  badge: { marginTop: 10, borderWidth: 1, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 14 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 18 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { color: colors.textMuted, fontSize: 12.5 },
  rowValue: { color: colors.text, fontSize: 15, marginTop: 2 },
});