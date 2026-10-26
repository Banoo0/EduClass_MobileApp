import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, radius, spacing } from '../core/theme';

// Kartu kecil untuk daftar yang kosong, contoh "Tidak ada jadwal pelajaran hari ini."
export default function EmptyState({ icon = 'information-circle-outline', text, style }) {
  return (
    <View style={[styles.box, style]}>
      <Ionicons name={icon} size={22} color={colors.textMuted} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md },
  text: { flex: 1, color: colors.textMuted, fontSize: fontSize.md, lineHeight: 21 },
});
