import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AuthHeader from '../../components/AuthHeader';
import AppInput from '../../components/AppInput';
import AppButton from '../../components/AppButton';
import FormAlert from '../../components/FormAlert';
import { useAuth } from '../../context/AuthContext';
import { fetchSchools } from '../../services/authServices';
import { colors, radius } from '../../core/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLES = [
  { key: 'siswa', title: 'Siswa', desc: 'Lihat jadwal dan kumpulkan tugas', icon: 'school-outline', accent: colors.siswa },
  { key: 'guru', title: 'Guru', desc: 'Kelola kelas, jadwal, dan tugas', icon: 'easel-outline', accent: colors.guru },
];

export default function RegisterScreen({ navigation }) {
  const { signUp } = useAuth();
  const scrollRef = useRef(null);
  const refs = { nomor: useRef(null), rombel: useRef(null), email: useRef(null), password: useRef(null), confirm: useRef(null) };

  const [role, setRole] = useState('siswa');
  const [nama, setNama] = useState('');
  const [nomorInduk, setNomorInduk] = useState('');
  const [rombel, setRombel] = useState('');
  const [schoolId, setSchoolId] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [schools, setSchools] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState('');

  const loadSchools = useCallback(async () => {
    setSchoolsLoading(true);
    setSchoolsError('');
    const { data, error } = await fetchSchools();
    if (error) setSchoolsError('Daftar sekolah gagal dimuat. Periksa koneksi, lalu coba lagi.');
    else setSchools(data);
    setSchoolsLoading(false);
  }, []);
  useEffect(() => { loadSchools(); }, [loadSchools]);

  const accent = ROLES.find((r) => r.key === role).accent;
  const isSiswa = role === 'siswa';

  const validate = () => {
    const e = {};
    if (nama.trim().length < 3) e.nama = 'Isi nama lengkap, minimal 3 huruf.';
    if (!email.trim()) e.email = 'Isi email terlebih dahulu.';
    else if (!EMAIL_RE.test(email.trim())) e.email = 'Format email belum benar. Contoh: nama@sekolah.sch.id';
    if (password.length < 6) e.password = 'Password minimal 6 karakter.';
    if (confirm !== password) e.confirm = 'Konfirmasi password belum sama dengan password.';
    if (schools.length > 0 && !schoolId) e.school = 'Pilih sekolahmu.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    Keyboard.dismiss();
    setFormError('');
    if (!validate()) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setSubmitting(true);
    const { error, needsEmailConfirmation } = await signUp({
      email, password, nama_lengkap: nama, role, nomor_induk: nomorInduk, rombel, school_id: schoolId,
    });
    setSubmitting(false);
    if (error) {
      setFormError(error.message);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    // Jika "Confirm email" nonaktif, sesi langsung aktif dan AuthContext membuka dashboard.
    if (needsEmailConfirmation) {
      Alert.alert('Cek emailmu', 'Kami mengirim tautan verifikasi ke ' + email.trim() + '. Klik tautan itu, lalu masuk.', [
        { text: 'Ke halaman masuk', onPress: () => navigation.navigate('Login') },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back} accessibilityLabel="Kembali">
            <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
            <Text style={styles.backText}>Kembali</Text>
          </Pressable>

          <AuthHeader title="Buat akun" subtitle="Pilih peranmu dulu, lalu isi data diri." />

          <Text style={styles.sectionLabel}>Daftar sebagai</Text>
          <View style={styles.roleRow}>
            {ROLES.map((r) => {
              const active = role === r.key;
              return (
                <Pressable key={r.key} onPress={() => setRole(r.key)} style={[styles.roleCard, active && { borderColor: r.accent, backgroundColor: colors.cardAlt }]}>
                  <View style={[styles.roleIcon, { backgroundColor: active ? r.accent : colors.cardAlt }]}>
                    <Ionicons name={r.icon} size={22} color={active ? '#0E1015' : colors.textMuted} />
                  </View>
                  <Text style={styles.roleTitle}>{r.title}</Text>
                  <Text style={styles.roleDesc}>{r.desc}</Text>
                  {active ? <Ionicons name="checkmark-circle" size={20} color={r.accent} style={styles.roleCheck} /> : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.card}>
            <FormAlert message={formError} />
            <AppInput label="Nama lengkap" required icon="person-outline" placeholder="Nama sesuai data sekolah" value={nama} onChangeText={setNama} error={errors.nama} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => refs.nomor.current?.focus()} />
            <AppInput ref={refs.nomor} label={isSiswa ? 'NISN' : 'NIP'} hint="opsional" icon="card-outline" placeholder={isSiswa ? 'Nomor induk siswa nasional' : 'Nomor induk pegawai'} value={nomorInduk} onChangeText={setNomorInduk} keyboardType="number-pad" returnKeyType="next" onSubmitEditing={() => (isSiswa ? refs.rombel : refs.email).current?.focus()} />
            {isSiswa ? (
              <AppInput ref={refs.rombel} label="Kelas" hint="opsional" icon="people-outline" placeholder="Contoh: 9C" value={rombel} onChangeText={setRombel} autoCapitalize="characters" returnKeyType="next" onSubmitEditing={() => refs.email.current?.focus()} />
            ) : null}

            <Text style={styles.fieldLabel}>
              Sekolah<Text style={{ color: colors.danger }}> *</Text>
            </Text>
            <View style={{ marginBottom: 16 }}>
              {schoolsLoading ? (
                <Text style={styles.schoolInfo}>Memuat daftar sekolah...</Text>
              ) : schoolsError ? (
                <View>
                  <Text style={[styles.schoolInfo, { color: colors.danger }]}>{schoolsError}</Text>
                  <Pressable onPress={loadSchools} style={styles.retry}><Text style={styles.retryText}>Muat ulang</Text></Pressable>
                </View>
              ) : schools.length === 0 ? (
                <Text style={styles.schoolInfo}>Belum ada sekolah terdaftar. Kamu tetap bisa melanjutkan.</Text>
              ) : (
                schools.map((s) => {
                  const active = schoolId === s.id;
                  return (
                    <Pressable key={s.id} onPress={() => setSchoolId(s.id)} style={[styles.schoolRow, active && { borderColor: accent, backgroundColor: colors.cardAlt }]}>
                      <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? accent : colors.textFaint} />
                      <Text style={styles.schoolName}>{s.nama_sekolah}</Text>
                    </Pressable>
                  );
                })
              )}
              {errors.school ? <Text style={styles.fieldError}>{errors.school}</Text> : null}
            </View>

            <AppInput ref={refs.email} label="Email" required icon="mail-outline" placeholder="nama@sekolah.sch.id" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" returnKeyType="next" onSubmitEditing={() => refs.password.current?.focus()} />
            <AppInput ref={refs.password} label="Password" required hint="minimal 6 karakter" icon="lock-closed-outline" placeholder="Buat password" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry autoCapitalize="none" returnKeyType="next" onSubmitEditing={() => refs.confirm.current?.focus()} />
            <AppInput ref={refs.confirm} label="Ulangi password" required icon="lock-closed-outline" placeholder="Ketik password sekali lagi" value={confirm} onChangeText={setConfirm} error={errors.confirm} secureTextEntry autoCapitalize="none" returnKeyType="done" onSubmitEditing={onSubmit} />

            <AppButton title="Daftar" variant="success" onPress={onSubmit} loading={submitting} style={{ marginTop: 4 }} />
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Sudah punya akun?</Text>
            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={10}>
              <Text style={styles.footerLink}> Masuk</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: 24, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', marginLeft: -6, marginBottom: 20, alignSelf: 'flex-start' },
  backText: { color: colors.textMuted, fontSize: 14.5 },
  sectionLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  roleCard: { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1.5, borderRadius: radius.lg, padding: 16 },
  roleIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  roleTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  roleDesc: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  roleCheck: { position: 'absolute', top: 12, right: 12 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 20 },
  fieldLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  fieldError: { color: colors.danger, fontSize: 12.5, marginTop: 6 },
  schoolInfo: { color: colors.textMuted, fontSize: 13.5, lineHeight: 20 },
  retry: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.cardAlt },
  retryText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  schoolRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 8 },
  schoolName: { flex: 1, color: colors.text, fontSize: 14.5 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: colors.textMuted, fontSize: 14.5 },
  footerLink: { color: colors.primary, fontSize: 14.5, fontWeight: '700' },
});