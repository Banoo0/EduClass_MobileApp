import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../core/theme';

// Layar sementara untuk tab yang belum dikerjakan. Ganti dengan layar aslimu di
// StudentTabs.js / TeacherTabs.js, lalu hapus pemakaian placeholder-nya.
export default function PlaceholderScreen({ title, owner }) {
  const { profile, role } = useAuth();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name="construct-outline" size={28} color={colors.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.desc}>Layar ini belum dikerjakan.{owner ? ' Penanggung jawab: ' + owner + '.' : ''}</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Login berhasil</Text>
          <Text style={styles.cardValue}>
            {profile?.nama_lengkap ?? '-'} ({role ?? '-'})
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  desc: { color: colors.textMuted, fontSize: 14.5, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  card: { marginTop: 24, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  cardLabel: { color: colors.textMuted, fontSize: 12.5 },
  cardValue: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 4 },
});