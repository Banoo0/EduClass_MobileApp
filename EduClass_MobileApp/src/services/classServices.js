import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from '../core/firebase';
import { deleteWhere, docToObject, toError } from '../core/firestoreHelpers';

// =====================================================
// STRUKTUR DATA FIRESTORE (pengganti tabel Supabase)
//   classes        : kelas (teacher_nama disimpan di sini supaya siswa bisa melihat nama guru)
//   class_tokens   : {token} -> { class_id, teacher_id, aktif }  (untuk gabung kelas)
//   class_members  : {classId}_{studentId} -> { class_id, student_id, teacher_id, student_nama, nomor_induk, token, joined_at }
//   schedules      : jadwal mingguan kelas
// =====================================================

// Tanpa huruf/angka yang mirip (I, O, 0, 1) supaya mudah diketik siswa.
const TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateToken(length = 6) {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += TOKEN_CHARS.charAt(Math.floor(Math.random() * TOKEN_CHARS.length));
  }
  return result;
}

const byJamMulai = (a, b) => String(a.jam_mulai || '').localeCompare(String(b.jam_mulai || ''));

async function fetchClassesByIds(classIds) {
  const snaps = await Promise.all(
    classIds.map((id) => getDoc(doc(db, 'classes', id)).catch(() => null))
  );
  return snaps
    .filter((snap) => snap && snap.exists())
    .map(docToObject)
    .sort((a, b) => String(a.nama_mapel || '').localeCompare(String(b.nama_mapel || '')));
}

// Satu query per kelas (aturan keamanan mensyaratkan filter class_id yang pasti).
export async function fetchSchedulesByClass(classIds) {
  const map = {};
  let firstError = null;
  await Promise.all(
    (classIds || []).map(async (classId) => {
      try {
        const snap = await getDocs(query(collection(db, 'schedules'), where('class_id', '==', classId)));
        map[classId] = snap.docs.map(docToObject).sort(byJamMulai);
      } catch (e) {
        map[classId] = [];
        if (!firstError) firstError = toError(e);
      }
    })
  );
  return { data: map, error: firstError };
}

// =====================================================
// KELAS GURU
// =====================================================

export async function fetchTeacherClasses(teacherId) {
  if (!teacherId) {
    return { data: null, error: new Error('Akun guru tidak ditemukan.') };
  }

  try {
    const [classSnap, memberSnap, scheduleSnap] = await Promise.all([
      getDocs(query(collection(db, 'classes'), where('teacher_id', '==', teacherId))),
      getDocs(query(collection(db, 'class_members'), where('teacher_id', '==', teacherId))),
      getDocs(query(collection(db, 'schedules'), where('teacher_id', '==', teacherId))),
    ]);

    const memberCount = {};
    memberSnap.forEach((d) => {
      const classId = d.data().class_id;
      memberCount[classId] = (memberCount[classId] || 0) + 1;
    });

    const schedulesByClass = {};
    scheduleSnap.forEach((d) => {
      const item = docToObject(d);
      if (!schedulesByClass[item.class_id]) schedulesByClass[item.class_id] = [];
      schedulesByClass[item.class_id].push(item);
    });

    const data = classSnap.docs
      .map(docToObject)
      .map((item) => ({
        ...item,
        jumlah_siswa: memberCount[item.id] || 0,
        schedules: (schedulesByClass[item.id] || []).sort(byJamMulai),
      }))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    return { data, error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

// =====================================================
// BUAT KELAS + JADWAL PERTAMA
// Token dibuat di sini (dulu oleh trigger Supabase) dan dijamin unik
// lewat dokumen class_tokens/{token}.
// =====================================================

export async function createClass({
  teacherId,
  nama_mapel,
  rombel,
  tahun_ajaran,
  semester,
  hari,
  jam_mulai,
  jam_selesai,
  ruang,
  gedung,
}) {
  const fail = (error) => ({ data: null, schedule: null, scheduleError: null, error });

  if (!teacherId) return fail(new Error('Akun guru tidak ditemukan.'));
  if (!nama_mapel?.trim()) return fail(new Error('Nama mata pelajaran wajib diisi.'));

  try {
    const teacherSnap = await getDoc(doc(db, 'users', teacherId));
    const teacherNama = teacherSnap.exists() ? teacherSnap.data().nama_lengkap || '' : '';

    const classRef = doc(collection(db, 'classes'));
    const scheduleRef = doc(collection(db, 'schedules'));
    const withSchedule = Boolean(hari && jam_mulai && jam_selesai);

    let token = null;
    let lastError = null;

    for (let attempt = 0; attempt < 3 && !token; attempt += 1) {
      const candidate = generateToken();
      // eslint-disable-next-line no-await-in-loop
      const taken = await getDoc(doc(db, 'class_tokens', candidate));
      if (!taken.exists()) {
        const batch = writeBatch(db);
        batch.set(classRef, {
          teacher_id: teacherId,
          teacher_nama: teacherNama,
          nama_mapel: nama_mapel.trim(),
          rombel: rombel?.trim() || null,
          tahun_ajaran: tahun_ajaran?.trim() || null,
          semester: semester?.trim() || null,
          token: candidate,
          aktif: true,
          created_at: serverTimestamp(),
        });
        batch.set(doc(db, 'class_tokens', candidate), {
          class_id: classRef.id,
          teacher_id: teacherId,
          aktif: true,
        });
        if (withSchedule) {
          batch.set(scheduleRef, {
            class_id: classRef.id,
            teacher_id: teacherId,
            judul: nama_mapel.trim(),
            hari,
            jam_mulai,
            jam_selesai,
            ruang: ruang?.trim() || null,
            gedung: gedung?.trim() || null,
            meeting_url: null,
            created_at: serverTimestamp(),
          });
        }
        try {
          // eslint-disable-next-line no-await-in-loop
          await batch.commit();
          token = candidate;
        } catch (e) {
          lastError = e;
        }
      }
    }

    if (!token) {
      return fail(toError(lastError) || new Error('Gagal membuat token kelas. Coba lagi.'));
    }

    const kelas = docToObject(await getDoc(classRef));
    const schedule = withSchedule ? docToObject(await getDoc(scheduleRef)) : null;
    return { data: kelas, schedule, scheduleError: null, error: null };
  } catch (e) {
    return fail(toError(e));
  }
}

// =====================================================
// EDIT INFORMASI KELAS
// =====================================================

export async function updateTeacherClass(classId, teacherId, fields) {
  if (!fields.nama_mapel?.trim()) {
    return { data: null, error: new Error('Nama mata pelajaran wajib diisi.') };
  }

  try {
    const ref = doc(db, 'classes', classId);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().teacher_id !== teacherId) {
      return { data: null, error: new Error('Kelas tidak ditemukan atau kamu tidak memiliki akses.') };
    }

    await updateDoc(ref, {
      nama_mapel: fields.nama_mapel.trim(),
      rombel: fields.rombel?.trim() || null,
      tahun_ajaran: fields.tahun_ajaran?.trim() || null,
      semester: fields.semester?.trim() || null,
    });

    return { data: docToObject(await getDoc(ref)), error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

// =====================================================
// HAPUS KELAS
// Firestore tidak punya ON DELETE CASCADE, jadi data turunan dihapus manual.
// Saat koleksi lain (assignments, submissions, materials, messages) sudah dibuat,
// tambahkan ke daftar CHILD_COLLECTIONS di bawah.
// =====================================================

const CHILD_COLLECTIONS = ['attendance', 'meetings', 'schedules', 'class_members'];

export async function deleteTeacherClass(classId, teacherId) {
  try {
    const ref = doc(db, 'classes', classId);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().teacher_id !== teacherId) {
      return { data: null, error: new Error('Kelas tidak ditemukan atau kamu tidak memiliki akses.') };
    }
    const token = snap.data().token;

    for (const name of CHILD_COLLECTIONS) {
      // eslint-disable-next-line no-await-in-loop
      await deleteWhere(name, [
        ['class_id', classId],
        ['teacher_id', teacherId],
      ]);
    }

    const batch = writeBatch(db);
    if (token) batch.delete(doc(db, 'class_tokens', token));
    batch.delete(ref);
    await batch.commit();

    return { data: { id: classId }, error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

// =====================================================
// AKTIF / NONAKTIF TOKEN KELAS
// =====================================================

export async function setClassActive(classId, aktif, teacherId) {
  try {
    const uid = teacherId || auth.currentUser?.uid;
    const ref = doc(db, 'classes', classId);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().teacher_id !== uid) {
      return { data: null, error: new Error('Kelas tidak ditemukan atau tidak dapat diubah.') };
    }

    const batch = writeBatch(db);
    batch.update(ref, { aktif });
    if (snap.data().token) batch.update(doc(db, 'class_tokens', snap.data().token), { aktif });
    await batch.commit();

    return { data: docToObject(await getDoc(ref)), error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

// =====================================================
// CRUD JADWAL KELAS
// scheduleId kosong = tambah jadwal, terisi = edit jadwal.
// =====================================================

export async function saveClassSchedule({
  classId,
  teacherId,
  scheduleId = null,
  judul,
  hari,
  jam_mulai,
  jam_selesai,
  ruang,
  gedung,
}) {
  if (!classId || !teacherId) {
    return { data: null, error: new Error('Informasi kelas atau guru tidak ditemukan.') };
  }
  if (!hari || !jam_mulai || !jam_selesai) {
    return { data: null, error: new Error('Hari dan jam wajib diisi.') };
  }
  if (jam_selesai <= jam_mulai) {
    return { data: null, error: new Error('Jam selesai harus setelah jam mulai.') };
  }

  const payload = {
    class_id: classId,
    teacher_id: teacherId,
    judul: judul?.trim() || null,
    hari,
    jam_mulai,
    jam_selesai,
    ruang: ruang?.trim() || null,
    gedung: gedung?.trim() || null,
  };

  try {
    let ref;
    if (scheduleId) {
      ref = doc(db, 'schedules', scheduleId);
      const snap = await getDoc(ref);
      if (!snap.exists() || snap.data().class_id !== classId || snap.data().teacher_id !== teacherId) {
        return { data: null, error: new Error('Jadwal tidak ditemukan atau tidak dapat disimpan.') };
      }
      await updateDoc(ref, payload);
    } else {
      ref = await addDoc(collection(db, 'schedules'), {
        ...payload,
        meeting_url: null,
        created_at: serverTimestamp(),
      });
    }
    return { data: docToObject(await getDoc(ref)), error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

export async function deleteClassSchedule(scheduleId, classId, teacherId) {
  try {
    const ref = doc(db, 'schedules', scheduleId);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().class_id !== classId || snap.data().teacher_id !== teacherId) {
      return { data: null, error: new Error('Jadwal tidak ditemukan atau kamu tidak memiliki akses.') };
    }

    // Pertemuan dan presensi milik jadwal ini ikut dihapus.
    const meetings = await getDocs(
      query(
        collection(db, 'meetings'),
        where('schedule_id', '==', scheduleId),
        where('teacher_id', '==', teacherId)
      )
    );
    for (const m of meetings.docs) {
      // eslint-disable-next-line no-await-in-loop
      await deleteWhere('attendance', [
        ['meeting_id', m.id],
        ['teacher_id', teacherId],
      ]);
    }
    await deleteWhere('meetings', [
      ['schedule_id', scheduleId],
      ['teacher_id', teacherId],
    ]);

    const batch = writeBatch(db);
    batch.delete(ref);
    await batch.commit();

    return { data: { id: scheduleId }, error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

// =====================================================
// SEMUA JADWAL MILIK GURU (dengan info kelas, seperti join di Supabase)
// =====================================================

export async function fetchTeacherSchedules(teacherId) {
  if (!teacherId) {
    return { data: null, error: new Error('Akun guru tidak ditemukan.') };
  }

  try {
    const [scheduleSnap, classSnap] = await Promise.all([
      getDocs(query(collection(db, 'schedules'), where('teacher_id', '==', teacherId))),
      getDocs(query(collection(db, 'classes'), where('teacher_id', '==', teacherId))),
    ]);

    const classMap = {};
    classSnap.forEach((d) => {
      const c = docToObject(d);
      classMap[c.id] = {
        id: c.id,
        nama_mapel: c.nama_mapel,
        rombel: c.rombel,
        tahun_ajaran: c.tahun_ajaran,
        semester: c.semester,
      };
    });

    const data = scheduleSnap.docs.map(docToObject).map((item) => ({
      ...item,
      classes: classMap[item.class_id] || null,
    }));
    return { data, error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

// =====================================================
// LAYANAN SISWA
// =====================================================

export async function joinClassByToken(token) {
  const normalizedToken = String(token || '').trim().toUpperCase();
  if (!normalizedToken) {
    return { data: null, error: new Error('Masukkan token kelas.') };
  }

  const uid = auth.currentUser?.uid;
  if (!uid) {
    return { data: null, error: new Error('Akun siswa tidak ditemukan. Silakan login ulang.') };
  }

  try {
    const tokenSnap = await getDoc(doc(db, 'class_tokens', normalizedToken));
    // data null tanpa error -> layar menampilkan "Kelas tidak ditemukan"
    if (!tokenSnap.exists()) return { data: null, error: null };

    const { class_id: classId, teacher_id: teacherId, aktif } = tokenSnap.data();
    if (aktif === false) {
      return { data: null, error: new Error('Token kelas ini sedang dinonaktifkan oleh guru.') };
    }

    const memberRef = doc(db, 'class_members', `${classId}_${uid}`);
    if ((await getDoc(memberRef)).exists()) {
      return { data: null, error: new Error('Kamu sudah bergabung di kelas ini.') };
    }

    const profileSnap = await getDoc(doc(db, 'users', uid));
    const profile = profileSnap.exists() ? profileSnap.data() : {};

    await setDoc(memberRef, {
      class_id: classId,
      student_id: uid,
      teacher_id: teacherId,
      student_nama: profile.nama_lengkap || '',
      nomor_induk: profile.nomor_induk || '',
      token: normalizedToken,
      joined_at: serverTimestamp(),
    });

    const classSnap = await getDoc(doc(db, 'classes', classId));
    return { data: classSnap.exists() ? docToObject(classSnap) : { id: classId }, error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

async function fetchStudentClassIds(studentId) {
  const snap = await getDocs(
    query(collection(db, 'class_members'), where('student_id', '==', studentId))
  );
  return [...new Set(snap.docs.map((d) => d.data().class_id).filter(Boolean))];
}

export async function fetchStudentClasses(studentId) {
  if (!studentId) {
    return { data: null, error: new Error('Akun siswa tidak ditemukan.') };
  }
  try {
    const classIds = await fetchStudentClassIds(studentId);
    if (!classIds.length) return { data: [], error: null };
    return { data: await fetchClassesByIds(classIds), error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

export async function fetchStudentSchedules(studentId) {
  if (!studentId) {
    return { data: null, error: new Error('Akun siswa tidak ditemukan.') };
  }
  try {
    const classIds = await fetchStudentClassIds(studentId);
    if (!classIds.length) return { data: [], error: null };

    const [classes, { data: byClass, error }] = await Promise.all([
      fetchClassesByIds(classIds),
      fetchSchedulesByClass(classIds),
    ]);
    if (error) return { data: null, error };

    const classMap = Object.fromEntries(
      classes.map((c) => [
        c.id,
        { id: c.id, nama_mapel: c.nama_mapel, rombel: c.rombel, teacher_nama: c.teacher_nama || null },
      ])
    );

    const data = Object.values(byClass)
      .flat()
      .map((item) => ({ ...item, classes: classMap[item.class_id] || null }))
      .sort(byJamMulai);
    return { data, error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}