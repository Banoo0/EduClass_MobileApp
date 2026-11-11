import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../core/firebase';
import { deleteWhere, docToObject, toError } from '../core/firestoreHelpers';

// =====================================================
// STRUKTUR DATA FIRESTORE
//   meetings   : {scheduleId}_{tanggal} -> { schedule_id, class_id, teacher_id, tanggal, topik, deskripsi,
//                                           presensi_dibuka_at, presensi_ditutup_at, created_at }
//   attendance : {meetingId}_{studentId} -> { meeting_id, class_id, teacher_id, student_id, status, waktu_absen }
// ID dokumen gabungan menggantikan UNIQUE constraint di Supabase:
// satu jadwal hanya punya satu pertemuan per tanggal, satu siswa satu presensi per pertemuan.
// =====================================================

async function getScheduleOrThrow(scheduleId) {
  const snap = await getDoc(doc(db, 'schedules', scheduleId));
  if (!snap.exists()) throw new Error('Jadwal tidak ditemukan.');
  return docToObject(snap);
}

async function getMeetingOrThrow(meetingId) {
  const snap = await getDoc(doc(db, 'meetings', meetingId));
  if (!snap.exists()) throw new Error('Pertemuan tidak ditemukan.');
  return docToObject(snap);
}

export async function fetchScheduleMeetings(scheduleId) {
  try {
    const schedule = await getScheduleOrThrow(scheduleId);
    const uid = auth.currentUser?.uid;

    const filters = [
      where('class_id', '==', schedule.class_id),
      where('schedule_id', '==', scheduleId),
    ];
    // Guru pemilik jadwal cukup membuktikan lewat teacher_id; siswa lewat keanggotaan kelas.
    if (schedule.teacher_id === uid) filters.push(where('teacher_id', '==', uid));

    const snap = await getDocs(query(collection(db, 'meetings'), ...filters));
    const data = snap.docs
      .map(docToObject)
      .sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')));
    return { data, error: null };
  } catch (e) {
    return { data: [], error: toError(e) };
  }
}

export async function createMeeting({ scheduleId, tanggal, topik, deskripsi }) {
  try {
    const schedule = await getScheduleOrThrow(scheduleId);
    const tanggalKey = String(tanggal).slice(0, 10); // YYYY-MM-DD
    const ref = doc(db, 'meetings', `${scheduleId}_${tanggalKey}`);

    if ((await getDoc(ref)).exists()) {
      return { data: null, error: new Error('Pertemuan pada tanggal ini sudah ada.') };
    }

    await setDoc(ref, {
      schedule_id: scheduleId,
      class_id: schedule.class_id,
      teacher_id: schedule.teacher_id,
      tanggal,
      topik: (topik || '').trim(),
      deskripsi: (deskripsi || '').trim(),
      presensi_dibuka_at: null,
      presensi_ditutup_at: null,
      created_at: serverTimestamp(),
    });
    return { data: docToObject(await getDoc(ref)), error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

export async function updateMeeting({ meetingId, tanggal, topik, deskripsi }) {
  try {
    const ref = doc(db, 'meetings', meetingId);
    await updateDoc(ref, {
      tanggal,
      topik: (topik || '').trim(),
      deskripsi: (deskripsi || '').trim(),
    });
    return { data: docToObject(await getDoc(ref)), error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

export async function deleteMeeting(meetingId) {
  try {
    const meeting = await getMeetingOrThrow(meetingId);
    await deleteWhere('attendance', [
      ['meeting_id', meetingId],
      ['teacher_id', meeting.teacher_id],
    ]);
    await deleteDoc(doc(db, 'meetings', meetingId));
    return { data: { id: meetingId }, error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

export async function setMeetingAttendanceOpen(meeting, open) {
  try {
    const ref = doc(db, 'meetings', meeting.id);
    await updateDoc(
      ref,
      open
        ? { presensi_dibuka_at: serverTimestamp(), presensi_ditutup_at: null }
        : { presensi_ditutup_at: serverTimestamp() }
    );
    return { data: docToObject(await getDoc(ref)), error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

// Daftar siswa kelas + status presensinya. Nama siswa diambil dari class_members
// (disalin saat siswa bergabung), karena profil siswa lain tidak bisa dibaca langsung.
export async function fetchMeetingRoster(classId, meetingId) {
  try {
    const uid = auth.currentUser?.uid;
    const [memberSnap, attendanceSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'class_members'),
          where('class_id', '==', classId),
          where('teacher_id', '==', uid)
        )
      ),
      getDocs(
        query(
          collection(db, 'attendance'),
          where('meeting_id', '==', meetingId),
          where('teacher_id', '==', uid)
        )
      ),
    ]);

    const attendanceByStudent = {};
    attendanceSnap.forEach((d) => {
      const row = docToObject(d);
      attendanceByStudent[row.student_id] = row;
    });

    const data = memberSnap.docs
      .map((d) => d.data())
      .filter((m) => m.student_id)
      .map((m) => ({
        id: m.student_id,
        nama_lengkap: m.student_nama || '',
        nomor_induk: m.nomor_induk || '',
        attendance: attendanceByStudent[m.student_id] || null,
      }))
      .sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));

    return { data, error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

export async function saveMeetingAttendance({ meetingId, studentId, status }) {
  try {
    const meeting = await getMeetingOrThrow(meetingId);
    const ref = doc(db, 'attendance', `${meetingId}_${studentId}`);
    await setDoc(ref, {
      meeting_id: meetingId,
      class_id: meeting.class_id,
      teacher_id: meeting.teacher_id,
      student_id: studentId,
      status,
      waktu_absen: serverTimestamp(),
    });
    return { data: docToObject(await getDoc(ref)), error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

// Pertemuan minggu ini + presensi milik siswa, untuk layar Jadwal siswa.
// Query per kelas (filter class_id dibutuhkan aturan keamanan), lalu disaring di aplikasi.
export async function fetchStudentWeekMeetings({ studentId, schedules, weekStartKey, weekEndKey }) {
  const empty = { meetings: [], attendanceMap: {} };
  try {
    const scheduleIds = new Set((schedules || []).map((item) => item.id).filter(Boolean));
    const classIds = [...new Set((schedules || []).map((item) => item.class_id).filter(Boolean))];
    if (!scheduleIds.size || !classIds.length) return { data: empty, error: null };

    const meetingSnaps = await Promise.all(
      classIds.map((classId) =>
        getDocs(query(collection(db, 'meetings'), where('class_id', '==', classId)))
      )
    );
    const meetings = meetingSnaps
      .flatMap((snap) => snap.docs.map(docToObject))
      .filter((m) => {
        const key = String(m.tanggal || '').slice(0, 10);
        return scheduleIds.has(m.schedule_id) && key >= weekStartKey && key <= weekEndKey;
      });

    const attendanceMap = {};
    const meetingIds = meetings.map((m) => m.id);
    for (let i = 0; i < meetingIds.length; i += 30) {
      // eslint-disable-next-line no-await-in-loop
      const snap = await getDocs(
        query(
          collection(db, 'attendance'),
          where('student_id', '==', studentId),
          where('meeting_id', 'in', meetingIds.slice(i, i + 30))
        )
      );
      snap.forEach((d) => {
        const row = docToObject(d);
        attendanceMap[row.meeting_id] = row;
      });
    }

    return { data: { meetings, attendanceMap }, error: null };
  } catch (e) {
    return { data: empty, error: toError(e) };
  }
}