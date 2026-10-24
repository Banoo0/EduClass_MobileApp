import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../core/theme';

// Banner pesan error untuk seluruh form (mis. "Email atau password salah")
export default function FormAlert({ message }) {
  if (!message) return null;
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={20} color={colors.danger} style={{ marginRight: 10, marginTop: 1 }} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(248,113,113,0.35)',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 18,
  },
  text: { flex: 1, color: colors.danger, fontSize: 13.5, lineHeight: 20 },
});