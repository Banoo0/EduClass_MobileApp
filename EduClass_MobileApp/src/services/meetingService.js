import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../core/firebase';
import { deleteWhere, docToObject, toError } from '../core/firestoreHelpers';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function dayFromDate(dateValue) {
  const [year, month, day] = String(dateValue || '').slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  return DAYS[new Date(year, month - 1, day).getDay()];
}

async function getMeetingOrThrow(meetingId) {
  const snap = await getDoc(doc(db, 'meetings', meetingId));
  if (!snap.exists()) throw new Error('Pertemuan tidak ditemukan.');
  return docToObject(snap);
}

export async function fetchClassMeetings(classId) {
  try {
    const snap = await getDocs(
      query(collection(db, 'meetings'), where('class_id', '==', classId))
    );
    const meetings = snap.docs.map(docToObject);

    // Pertemuan yang dibuat sebelum model baru mengambil hari/jam dari jadwal lama.
    const legacyScheduleIds = [...new Set(
      meetings.filter((row) => (!row.jam_mulai || !row.jam_selesai) && row.schedule_id)
        .map((row) => row.schedule_id)
    )];
    const scheduleSnaps = await Promise.all(
      legacyScheduleIds.map((scheduleId) => getDoc(doc(db, 'schedules', scheduleId)))
    );
    const scheduleMap = Object.fromEntries(
      scheduleSnaps.filter((item) => item.exists()).map((item) => [item.id, docToObject(item)])
    );

    const enriched = meetings.map((row) => {
      const legacySchedule = scheduleMap[row.schedule_id] || {};
      return {
        ...row,
        hari: row.hari || dayFromDate(row.tanggal),
        jam_mulai: row.jam_mulai || legacySchedule.jam_mulai || '',
        jam_selesai: row.jam_selesai || legacySchedule.jam_selesai || '',
      };
    }).sort((a, b) => {
      const byNumber = Number(a.pertemuan_ke || 0) - Number(b.pertemuan_ke || 0);
      if (byNumber && a.pertemuan_ke && b.pertemuan_ke) return byNumber;
      return String(a.tanggal || '').localeCompare(String(b.tanggal || ''));
    });

    const usedNumbers = new Set(
      enriched.map((row) => Number(row.pertemuan_ke)).filter((number) => Number.isInteger(number) && number > 0)
    );
    let fallbackNumber = 1;
    const numbered = enriched.map((row) => {
      const explicitNumber = Number(row.pertemuan_ke);
      if (Number.isInteger(explicitNumber) && explicitNumber > 0) return row;
      while (usedNumbers.has(fallbackNumber)) fallbackNumber += 1;
      const assignedNumber = fallbackNumber;
      usedNumbers.add(assignedNumber);
      fallbackNumber += 1;
      return { ...row, pertemuan_ke: assignedNumber };
    }).sort((a, b) => Number(a.pertemuan_ke) - Number(b.pertemuan_ke));

    return { data: numbered, error: null };
  } catch (e) {
    return { data: [], error: toError(e) };
  }
}

export async function createMeeting({ classId, teacherId, pertemuanKe, tanggal, jam_mulai, jam_selesai, topik, deskripsi, meeting_url = "" }) {
  try {
    const classSnap = await getDoc(doc(db, 'classes', classId));
    if (!classSnap.exists() || classSnap.data().teacher_id !== teacherId) {
      throw new Error('Kelas tidak ditemukan atau kamu tidak memiliki akses.');
    }

    const meetingId = `${classId}_meeting_${String(pertemuanKe).padStart(3, '0')}`;
    const meetingRef = doc(db, 'meetings', meetingId);
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(meetingRef);
      if (existing.exists()) throw new Error('Nomor pertemuan tersebut sudah digunakan.');
      transaction.set(meetingRef, {
        class_id: classId,
        teacher_id: teacherId,
        pertemuan_ke: Number(pertemuanKe),
        tanggal,
        hari: dayFromDate(tanggal),
        jam_mulai,
        jam_selesai,
        topik: topik.trim(),
        deskripsi: deskripsi.trim(),
        meeting_url: validateMeetingUrl(meeting_url),
        presensi_dibuka_at: null,
        presensi_ditutup_at: null,
        created_at: serverTimestamp(),
      });
    });
    return { data: await getMeetingOrThrow(meetingId), error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

export async function updateMeeting({ meetingId, tanggal, jam_mulai, jam_selesai, topik, deskripsi, meeting_url = "" }) {
  try {
    const ref = doc(db, 'meetings', meetingId);
    const current = await getDoc(ref);
    if (!current.exists()) throw new Error('Pertemuan tidak ditemukan.');
    await updateDoc(ref, {
      tanggal,
      hari: dayFromDate(tanggal),
      jam_mulai,
      jam_selesai,
      topik: topik.trim(),
      deskripsi: deskripsi.trim(),
        meeting_url: validateMeetingUrl(meeting_url),
    });
    return { data: await getMeetingOrThrow(meetingId), error: null };
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
    return { data: await getMeetingOrThrow(meeting.id), error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

export async function fetchMeetingRoster(classId, meetingId) {
  try {
    const uid = auth.currentUser?.uid;
    const [memberSnap, attendanceSnap] = await Promise.all([
      getDocs(query(
        collection(db, 'class_members'),
        where('class_id', '==', classId),
        where('teacher_id', '==', uid)
      )),
      getDocs(query(
        collection(db, 'attendance'),
        where('meeting_id', '==', meetingId),
        where('teacher_id', '==', uid)
      )),
    ]);

    const attendanceByStudent = {};
    attendanceSnap.forEach((snap) => {
      const row = docToObject(snap);
      attendanceByStudent[row.student_id] = row;
    });
    const data = memberSnap.docs.map((snap) => snap.data())
      .filter((member) => member.student_id)
      .map((member) => ({
        id: member.student_id,
        nama_lengkap: member.student_nama || '',
        nomor_induk: member.nomor_induk || '',
        attendance: attendanceByStudent[member.student_id] || null,
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
    return { data: { ...(await getMeetingAttendance(ref)), id: ref.id }, error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

async function getMeetingAttendance(ref) {
  const snap = await getDoc(ref);
  return snap.exists() ? docToObject(snap) : null;
}

export async function fetchStudentClassMeetings({ classId, studentId }) {
  try {
    const [{ data: meetings, error: meetingError }, attendanceSnap] = await Promise.all([
      fetchClassMeetings(classId),
      getDocs(query(
        collection(db, 'attendance'),
        where('class_id', '==', classId),
        where('student_id', '==', studentId)
      )),
    ]);
    if (meetingError) throw meetingError;
    const attendanceMap = {};
    attendanceSnap.forEach((snap) => {
      const row = docToObject(snap);
      attendanceMap[row.meeting_id] = row;
    });
    return { data: meetings.map((meeting) => ({ ...meeting, attendance: attendanceMap[meeting.id] || null })), error: null };
  } catch (e) {
    return { data: [], error: toError(e) };
  }
}

export async function fetchStudentWeekMeetings({ studentId, weekStartKey, weekEndKey }) {
  const empty = { meetings: [], attendanceMap: {} };
  try {
    const memberships = await getDocs(query(
      collection(db, 'class_members'),
      where('student_id', '==', studentId)
    ));
    const classIds = [...new Set(memberships.docs.map((snap) => snap.data().class_id).filter(Boolean))];
    if (!classIds.length) return { data: empty, error: null };

    const classResults = await Promise.all(classIds.map(async (classId) => {
      const [{ data: classMeetings, error }, classSnap, attendanceSnap] = await Promise.all([
        fetchClassMeetings(classId),
        getDoc(doc(db, 'classes', classId)),
        getDocs(query(
          collection(db, 'attendance'),
          where('class_id', '==', classId),
          where('student_id', '==', studentId)
        )),
      ]);
      if (error) throw error;
      const classData = classSnap.exists() ? docToObject(classSnap) : {};
      return {
        meetings: classMeetings
          .filter((meeting) => {
            const key = String(meeting.tanggal || '').slice(0, 10);
            return key >= weekStartKey && key <= weekEndKey;
          })
          .map((meeting) => ({
            ...meeting,
            schedule_id: meeting.schedule_id || meeting.id,
            classes: {
              id: classData.id || classId,
              nama_mapel: classData.nama_mapel || 'Kelas',
              rombel: classData.rombel || null,
              teacher_nama: classData.teacher_nama || null,
            },
          })),
        attendance: attendanceSnap.docs.map(docToObject),
      };
    }));

    const meetings = classResults.flatMap((result) => result.meetings);
    const attendanceMap = Object.fromEntries(
      classResults.flatMap((result) => result.attendance.map((row) => [row.meeting_id, row]))
    );
    return { data: { meetings, attendanceMap }, error: null };
  } catch (e) {
    return { data: empty, error: toError(e) };
  }
}

// Only HTTPS Google Meet and Zoom links are accepted.
export function validateMeetingUrl(value) {
  const url = String(value || '').trim();
  if (url && !/^https:\/\/(meet\.google\.com|([a-z0-9-]+\.)*zoom\.us)\/[^\s]+$/i.test(url)) {
    throw new Error('Gunakan link HTTPS Google Meet atau Zoom yang valid.');
  }
  return url;
}

export async function fetchMeetingMemberCount(classId, teacherId) {
  const snap = await getDocs(query(collection(db, 'class_members'),
    where('class_id', '==', classId), where('teacher_id', '==', teacherId)));
  return snap.size;
}

export async function markOwnAttendance(meetingId) {
  try {
    const studentId = auth.currentUser?.uid;
    if (!studentId) throw new Error('Silakan login ulang.');
    const meeting = await getMeetingOrThrow(meetingId);
    const ref = doc(db, 'attendance', `${meetingId}_${studentId}`);
    await runTransaction(db, async transaction => {
      const existing = await transaction.get(ref);
      if (existing.exists()) throw new Error('Presensi sudah tercatat.');
      transaction.set(ref, {
        meeting_id: meetingId, class_id: meeting.class_id,
        teacher_id: meeting.teacher_id, student_id: studentId,
        status: 'hadir', waktu_absen: serverTimestamp(),
      });
    });
    return { data: await getMeetingAttendance(ref), error: null };
  } catch (e) {
    console.error('markOwnAttendance', e);
    return { data: null, error: toError(e) };
  }
}
