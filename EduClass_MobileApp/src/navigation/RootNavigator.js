import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../components/AppButton.js';
import { useAuth } from '../context/AuthContext';
import AuthStack from './AuthStack';
import StudentTabs from './StudentTabs';
import TeacherTabs from './TeacherTabs';
import { colors, radius } from '../core/theme';

const Stack = createNativeStackNavigator();

function SplashScreen() {
  return (
    <View style={styles.center}>
      <View style={styles.logo}>
        <Ionicons name="school" size={34} color="#FFFFFF" />
      </View>
      <Text style={styles.brand}>EduClass</Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
    </View>
  );
}

// Dipakai jika sudah login tetapi baris profilnya tidak bisa dibaca dari database
function ProfileMissingScreen() {
  const { profileError, signOut, refreshProfile } = useAuth();
  return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
      <Text style={styles.problemTitle}>Profilmu belum bisa dimuat</Text>
      <Text style={styles.problemText}>
        Akunmu sudah masuk, tetapi data profil tidak ditemukan. Coba muat ulang. Kalau tetap gagal, keluar lalu hubungi tim pengembang.
      </Text>
      {profileError ? <Text style={styles.problemDetail}>{profileError}</Text> : null}
      <View style={{ width: '100%', gap: 12, marginTop: 24 }}>
        <AppButton title="Muat ulang" onPress={refreshProfile} />
        <AppButton title="Keluar" variant="outline" onPress={() => signOut()} />
      </View>
    </View>
  );
}

// Pintu masuk tunggal: arah ditentukan oleh status login dan role dari tabel profiles.
export default function RootNavigator() {
  const { session, profile, role, loading } = useAuth();

  if (loading) return <SplashScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {!session ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : !profile ? (
        <Stack.Screen name="ProfilTidakDitemukan" component={ProfileMissingScreen} />
      ) : role === 'guru' ? (
        <Stack.Screen name="GuruApp" component={TeacherTabs} />
      ) : (
        <Stack.Screen name="SiswaApp" component={StudentTabs} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  logo: { width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brand: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 16 },
  problemTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  problemText: { color: colors.textMuted, fontSize: 14.5, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  problemDetail: { color: colors.textFaint, fontSize: 12.5, textAlign: 'center', marginTop: 12 },
});