import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../core/firebase';

// Ubah kode error Firebase menjadi pesan yang jelas untuk pengguna.
export function translateAuthError(error) {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau password salah. Periksa lagi, lalu coba masuk.';
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar. Silakan masuk memakai email tersebut.';
    case 'auth/weak-password':
      return 'Password terlalu pendek. Gunakan minimal 6 karakter.';
    case 'auth/invalid-email':
      return 'Format email tidak valid. Contoh: nama@sekolah.sch.id';
    case 'auth/user-disabled':
      return 'Akun ini dinonaktifkan. Hubungi tim pengembang.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Tunggu beberapa menit, lalu coba lagi.';
    case 'auth/network-request-failed':
      return 'Tidak bisa terhubung ke server. Periksa koneksi internetmu.';
    case 'permission-denied':
      return 'Akses ditolak oleh aturan keamanan database. Hubungi tim pengembang.';
    default:
      return error?.message || 'Terjadi kesalahan. Coba lagi.';
  }
}

export async function signInWithEmail(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    return { error: null };
  } catch (e) {
    return { error: new Error(translateAuthError(e)) };
  }
}

// Berbeda dengan Supabase, profil dibuat oleh aplikasi (dokumen users/{uid}), bukan trigger database.
export async function signUpWithEmail({ email, password, nama_lengkap, role, nomor_induk, rombel, school_id }) {
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  } catch (e) {
    return { error: new Error(translateAuthError(e)), needsEmailConfirmation: false };
  }

  // Simpan nama sekolah di profil supaya bisa ditampilkan tanpa query tambahan
  let schoolNama = '';
  if (school_id) {
    try {
      const s = await getDoc(doc(db, 'schools', school_id));
      if (s.exists()) schoolNama = s.data().nama_sekolah || '';
    } catch (e) {
      // Nama sekolah hanya tambahan, abaikan jika gagal
    }
  }

  try {
    await setDoc(doc(db, 'users', cred.user.uid), {
      nama_lengkap: nama_lengkap.trim(),
      role,
      nomor_induk: (nomor_induk || '').trim(),
      rombel: role === 'siswa' ? (rombel || '').trim() : '',
      school_id: school_id || '',
      school_nama: schoolNama,
      created_at: serverTimestamp(),
    });
  } catch (e) {
    // Jangan biarkan akun setengah jadi (bisa login tetapi tidak punya profil)
    try {
      await deleteUser(cred.user);
    } catch (_) {
      // abaikan
    }
    return {
      error: new Error('Akun gagal dibuat karena profil tidak bisa disimpan. ' + translateAuthError(e)),
      needsEmailConfirmation: false,
    };
  }

  // Firebase tidak memakai verifikasi email di alur ini, jadi sesi langsung aktif
  return { error: null, needsEmailConfirmation: false };
}

export async function signOutUser() {
  try {
    await firebaseSignOut(auth);
    return { error: null };
  } catch (e) {
    return { error: e };
  }
}

export async function fetchSchools() {
  try {
    const snap = await getDocs(query(collection(db, 'schools'), orderBy('nama_sekolah')));
    return { data: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: null };
  } catch (e) {
    return { data: [], error: e };
  }
}

// Bentuk profil dibuat sama seperti versi Supabase, jadi layar tidak perlu diubah.
function toProfile(id, data) {
  return { id, ...data, school: data.school_nama ? { nama_sekolah: data.school_nama } : null };
}

// Dokumen profil dibuat sesaat setelah akun, jadi baca ulang beberapa kali sebelum dianggap hilang.
export async function fetchProfile(userId, { retries = 5, delayMs = 500 } = {}) {
  for (let i = 0; i <= retries; i += 1) {
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) return { data: toProfile(userId, snap.data()), error: null };
    } catch (e) {
      return { data: null, error: new Error(translateAuthError(e)) };
    }
    if (i < retries) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { data: null, error: null };
}