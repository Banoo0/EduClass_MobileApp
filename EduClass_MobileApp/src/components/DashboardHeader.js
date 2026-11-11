import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, radius, spacing } from '../core/theme';

const VARIANTS = {
  siswa: { brand: 'EduClass', logoBg: colors.primary, logoIcon: 'school', logoColor: colors.onAccent, avatar: colors.siswa },
  guru: { brand: 'EDUCLASS GURU', logoBg: colors.primarySoft, logoIcon: 'school-outline', logoColor: colors.guru, avatar: colors.guru },
};

// Header Beranda: logo + nama aplikasi + judul halaman, lonceng, dan avatar.
// variant: 'siswa' | 'guru'. onAvatarPress biasanya membuka tab Profil.
export default function DashboardHeader({ variant = 'siswa', title, onAvatarPress }) {
  const v = VARIANTS[variant] ?? VARIANTS.siswa;
  return (
    <View style={styles.header}>
      <View style={[styles.logo, { backgroundColor: v.logoBg }]}>
        <Ionicons name={v.logoIcon} size={22} color={v.logoColor} />
      </View>
      <View style={styles.titleWrap}>
        <Text style={[styles.brand, variant === 'guru' && styles.brandCaps]} numberOfLines={1}>
          {v.brand}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {/* Lonceng belum punya layar notifikasi, sementara hanya tampilan */}
      <View style={styles.iconButton} accessibilityLabel="Notifikasi">
        <Ionicons name="notifications-outline" size={22} color={colors.text} />
      </View>
      <Pressable
        onPress={onAvatarPress}
        disabled={!onAvatarPress}
        accessibilityRole="button"
        accessibilityLabel="Buka profil"
        style={[styles.avatar, { backgroundColor: v.avatar }]}
      >
        <Ionicons name="person-outline" size={20} color={colors.bg} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md + spacing.xs,
    paddingVertical: spacing.sm + spacing.xs,
  },
  logo: { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1 },
  brand: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  brandCaps: { letterSpacing: 1 },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  iconButton: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
