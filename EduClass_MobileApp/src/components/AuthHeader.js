import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../core/theme';

// Logo EduClass (kotak biru + topi toga, seperti di header mockup) lalu judul halaman.
export default function AuthHeader({ title, subtitle }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <View style={styles.logo}>
          <Ionicons name="school" size={22} color="#FFFFFF" />
        </View>
        <Text style={styles.brand}>EduClass</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 28 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  logo: {
    width: 42,
    height: 42,
    borderRadius: radius.md - 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brand: { color: colors.text, fontSize: 18, fontWeight: '700' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: 8 },
});