
import { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '../../components/AppButton';
import AppInput from '../../components/AppInput';
import FormAlert from '../../components/FormAlert';

import { joinClassByToken } from '../../services/classServices';

import {
  colors,
  fontSize,
  fontWeight,
  radius,
  spacing,
} from '../../core/theme';

function notify(title, message) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function GabungKelasScreen({ navigation }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    const normalizedToken = token.trim().toUpperCase();

    if (!normalizedToken) {
      setError('Masukkan token kelas dari guru.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: joinError } =
        await joinClassByToken(normalizedToken);

      if (joinError) {
        setError(joinError.message || 'Gagal bergabung dengan kelas.');
        return;
      }

      if (!data) {
        setError('Kelas tidak ditemukan. Periksa kembali tokennya.');
        return;
      }

      setToken('');

      notify(
        'Berhasil bergabung!',
        'Kelas berhasil ditambahkan ke daftar kelas kamu.'
      );

      // Kembali ke daftar kelas.
      // KelasScreen akan memuat ulang data saat kembali aktif.
      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat bergabung.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tombol kembali */}
        <AppButton
          title="Kembali ke Kelas"
          icon="arrow-back-outline"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        />

        {/* Header */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              name="key-outline"
              size={34}
              color={colors.primary}
            />
          </View>

          <Text style={styles.title}>Gabung Kelas</Text>

          <Text style={styles.subtitle}>
            Masukkan token yang diberikan oleh guru untuk bergabung
            dengan kelas.
          </Text>
        </View>

        <FormAlert message={error} />

        {/* Form token */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Token Kelas</Text>

          <Text style={styles.formSubtitle}>
            Pastikan kode yang kamu masukkan sesuai dengan token
            dari guru.
          </Text>

          <AppInput
            label="Masukkan Token"
            required
            placeholder="Contoh: INF-X3-A1B2"
            value={token}
            onChangeText={(value) =>
              setToken(value.toUpperCase())
            }
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={handleJoin}
          />

          <AppButton
            title="Gabung Sekarang"
            icon="enter-outline"
            onPress={handleJoin}
            loading={loading}
            disabled={!token.trim() || loading}
          />
        </View>

        {/* Panduan */}
        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={23}
            color={colors.primary}
          />

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              Belum punya token?
            </Text>

            <Text style={styles.infoText}>
              Minta token kelas kepada guru mata pelajaranmu.
              Kamu hanya bisa bergabung menggunakan token yang
              valid dan masih aktif.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const GUTTER = spacing.md + spacing.xs;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: GUTTER,
    paddingBottom: spacing.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heroIcon: {
    width: 76,
    height: 76,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.heavy,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: GUTTER,
  },
  formTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  formSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  infoText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 21,
  },
});
