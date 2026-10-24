import { supabase } from '../core/supabase';

// Ubah pesan error bawaan Supabase menjadi pesan yang jelas untuk pengguna.
export function translateAuthError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('invalid login credentials')) return 'Email atau password salah. Periksa lagi, lalu coba masuk.';
  if (msg.includes('email not confirmed')) return 'Email belum diverifikasi. Buka kotak masuk emailmu dan klik tautan verifikasi.';
  if (msg.includes('already registered') || msg.includes('already been registered')) return 'Email ini sudah terdaftar. Silakan masuk memakai email tersebut.';
  if (msg.includes('password should be at least')) return 'Password terlalu pendek. Gunakan minimal 6 karakter.';
  if (msg.includes('unable to validate email') || msg.includes('invalid email')) return 'Format email tidak valid. Contoh: nama@sekolah.sch.id';
  if (msg.includes('database error saving new user')) return 'Akun dibuat tetapi profil gagal disimpan. Coba lagi, atau hubungi tim pengembang.';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Terlalu banyak percobaan. Tunggu beberapa menit, lalu coba lagi.';
  if (msg.includes('network') || msg.includes('failed to fetch')) return 'Tidak bisa terhubung ke server. Periksa koneksi internetmu.';
  return error?.message || 'Terjadi kesalahan. Coba lagi.';
}

export async function signInWithEmail(email, password) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  return { error: error ? new Error(translateAuthError(error)) : null };
}

// Profil dibuat otomatis oleh trigger di database dari data di options.data
export async function signUpWithEmail({ email, password, nama_lengkap, role, nomor_induk, rombel, school_id }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        nama_lengkap: nama_lengkap.trim(),
        role,
        nomor_induk: (nomor_induk || '').trim(),
        rombel: role === 'siswa' ? (rombel || '').trim() : '',
        school_id: school_id || '',
      },
    },
  });
  if (error) return { error: new Error(translateAuthError(error)), needsEmailConfirmation: false };
  // Jika "Confirm email" aktif di Supabase, sesi belum ada sampai email diverifikasi
  return { error: null, needsEmailConfirmation: !data.session };
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function fetchSchools() {
  const { data, error } = await supabase
    .from('schools')
    .select('id, nama_sekolah')
    .order('nama_sekolah');
  return { data: data ?? [], error };
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, school:schools(nama_sekolah)')
    .eq('id', userId)
    .maybeSingle();
  return { data, error };
}