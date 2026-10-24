import { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthHeader from '../../components/AuthHeader';
import AppInput from '../../components/AppInput';
import AppButton from '../../components/AppButton.js';
import FormAlert from '../../components/FormAlert';
import { useAuth } from '../../context/AuthContext';
import { colors, radius } from '../../core/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pintasan untuk tim saat development (tidak tampil di aplikasi final)
const AKUN_UJI = [
  { label: 'Guru', email: 'guru@educlass.test' },
  { label: 'Siswa 1', email: 'siswa1@educlass.test' },
  { label: 'Siswa 2', email: 'siswa2@educlass.test' },
];

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const passwordRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = 'Isi email terlebih dahulu.';
    else if (!EMAIL_RE.test(email.trim())) e.email = 'Format email belum benar. Contoh: nama@sekolah.sch.id';
    if (!password) e.password = 'Isi password terlebih dahulu.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    Keyboard.dismiss();
    setFormError('');
    if (!validate()) return;
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    // Jika berhasil, AuthContext otomatis mengarahkan ke dashboard sesuai role
    if (error) setFormError(error.message);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthHeader title="Selamat datang kembali" subtitle="Masuk untuk melihat jadwal dan tugasmu." />

          <View style={styles.card}>
            <FormAlert message={formError} />
            <AppInput
              label="Email"
              required
              icon="mail-outline"
              placeholder="nama@sekolah.sch.id"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <AppInput
              ref={passwordRef}
              label="Password"
              required
              icon="lock-closed-outline"
              placeholder="Masukkan password"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
            <AppButton title="Masuk" onPress={onSubmit} loading={submitting} style={{ marginTop: 4 }} />
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Belum punya akun?</Text>
            <Pressable onPress={() => navigation.navigate('Register')} hitSlop={10}>
              <Text style={styles.footerLink}> Daftar</Text>
            </Pressable>
          </View>

          {__DEV__ ? (
            <View style={styles.devBox}>
              <Text style={styles.devTitle}>Mode development: isi email akun uji</Text>
              <View style={styles.devRow}>
                {AKUN_UJI.map((a) => (
                  <Pressable key={a.email} onPress={() => { setEmail(a.email); setErrors({}); setFormError(''); }} style={styles.devChip}>
                    <Text style={styles.devChipText}>{a.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 36 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 20 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: colors.textMuted, fontSize: 14.5 },
  footerLink: { color: colors.primary, fontSize: 14.5, fontWeight: '700' },
  devBox: { marginTop: 32, padding: 14, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  devTitle: { color: colors.textFaint, fontSize: 12.5, marginBottom: 10 },
  devRow: { flexDirection: 'row', gap: 8 },
  devChip: { backgroundColor: colors.cardAlt, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 14 },
  devChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});