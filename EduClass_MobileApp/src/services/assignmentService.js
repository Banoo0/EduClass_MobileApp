import {
  Timestamp, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { auth, db } from '../core/firebase';
import { docToObject, toError } from '../core/firestoreHelpers';

const submissionId = (assignmentId, studentId) => `${assignmentId}_${studentId}`;
export const validDriveUrl = (value) => typeof value === 'string' && value.length <= 2048 && /^https:\/\/(?:drive|docs)\.google\.com\/[^\s]+$/i.test(value.trim());
const profileName = (profile) => profile?.nama_lengkap || profile?.name || '';
const classLabel = (item) => [item.nama_mapel, item.rombel].filter(Boolean).join(' ');

export async function fetchStudentAssignments(studentId) {
  try {
    if (!studentId) throw new Error('Akun siswa tidak ditemukan. Silakan login ulang.');
    const memberSnap = await getDocs(query(collection(db, 'class_members'), where('student_id', '==', studentId)));
    const classIds = [...new Set(memberSnap.docs.map((item) => item.data().class_id).filter(Boolean))];
    if (!classIds.length) return { data: [], error: null };
    const results = await Promise.all(classIds.map(async (classId) => {
      const [assignmentSnap, classSnap] = await Promise.all([
        getDocs(query(collection(db, 'assignments'), where('class_id', '==', classId), where('status', '==', 'terbit'))),
        getDoc(doc(db, 'classes', classId)),
      ]);
      const klass = classSnap.exists() ? docToObject(classSnap) : {};
      return assignmentSnap.docs.map(docToObject).map((item) => ({ ...item, class: klass }));
    }));
    const rows = results.flat();
    const ownSubs = await Promise.all(rows.map((item) => getDoc(doc(db, 'submissions', submissionId(item.id, studentId)))));
    return { data: rows.map((item, index) => ({ ...item, submission: ownSubs[index].exists() ? docToObject(ownSubs[index]) : null }))
      .sort((a, b) => String(a.deadline || '').localeCompare(String(b.deadline || ''))), error: null };
  } catch (e) { return { data: [], error: toError(e) }; }
}

export async function fetchStudentAssignmentDetails(assignmentId, studentId) {
  try {
    const snap = await getDoc(doc(db, 'assignments', assignmentId));
    if (!snap.exists()) throw new Error('Tugas tidak ditemukan.');
    const assignment = docToObject(snap);
    const [classSnap, submissionSnap] = await Promise.all([
      getDoc(doc(db, 'classes', assignment.class_id)),
      getDoc(doc(db, 'submissions', submissionId(assignmentId, studentId))),
    ]);
    return { data: { ...assignment, class: classSnap.exists() ? docToObject(classSnap) : {}, submission: submissionSnap.exists() ? docToObject(submissionSnap) : null }, error: null };
  } catch (e) { return { data: null, error: toError(e) }; }
}

export async function fetchTeacherAssignments(teacherId) {
  try {
    const snap = await getDocs(query(collection(db, 'assignments'), where('teacher_id', '==', teacherId)));
    const data = await Promise.all(snap.docs.map(async (assignmentSnap) => {
      const item = docToObject(assignmentSnap);
      const [classSnap, submissions] = await Promise.all([
        getDoc(doc(db, 'classes', item.class_id)),
        getDocs(query(collection(db, 'submissions'), where('assignment_id', '==', item.id), where('teacher_id', '==', teacherId))),
      ]);
      const klass = classSnap.exists() ? docToObject(classSnap) : {};
      const memberSnap = await getDocs(query(collection(db, 'class_members'), where('class_id', '==', item.class_id), where('teacher_id', '==', teacherId)));
      const subs = submissions.docs.map(docToObject);
      return { ...item, class: klass, submissionCount: subs.length, studentCount: memberSnap.size, ungradedCount: subs.filter((row) => row.nilai == null).length };
    }));
    return { data: data.sort((a, b) => String(a.deadline || '').localeCompare(String(b.deadline || ''))), error: null };
  } catch (e) { return { data: [], error: toError(e) }; }
}

export async function createAssignment({ classItem, teacherId, teacher, judul, deskripsi, deadline, attachmentUrl = '', publish = false }) {
  try {
    if (attachmentUrl.trim() && !validDriveUrl(attachmentUrl)) throw new Error('Link soal Google Drive tidak valid.');
    const classId = classItem?.id;
    const classSnap = await getDoc(doc(db, 'classes', classId));
    if (!classSnap.exists() || classSnap.data().teacher_id !== teacherId) throw new Error('Kelas tidak ditemukan atau bukan milik akun guru ini.');
    const assignmentRef = doc(collection(db, 'assignments'));
    await setDoc(assignmentRef, {
      class_id: classId, class_nama: classLabel(classItem), teacher_id: teacherId,
      teacher_nama: profileName(teacher), judul: judul.trim(), deskripsi: deskripsi.trim(),
      deadline: new Date(deadline).toISOString(), deadline_at: Timestamp.fromDate(new Date(deadline)), attachment_url: attachmentUrl.trim(), status: publish ? 'terbit' : 'draft',
      created_at: serverTimestamp(), updated_at: serverTimestamp(),
    });
    const result = await getDoc(assignmentRef);
    return { data: docToObject(result), error: null };
  } catch (e) { return { data: null, error: toError(e) }; }
}

export async function setAssignmentStatus(assignmentId, status) {
  try {
    if (!['draft', 'terbit'].includes(status)) throw new Error('Status tugas tidak valid.');
    await updateDoc(doc(db, 'assignments', assignmentId), { status, updated_at: serverTimestamp() });
    const snap = await getDoc(doc(db, 'assignments', assignmentId));
    return { data: docToObject(snap), error: null };
  } catch (e) { return { data: null, error: toError(e) }; }
}

export async function fetchAssignmentSubmissions(assignmentId) {
  try {
    const snap = await getDocs(query(collection(db, 'submissions'), where('assignment_id', '==', assignmentId), where('teacher_id', '==', auth.currentUser?.uid)));
    return { data: snap.docs.map(docToObject).sort((a, b) => String(a.student_nama || '').localeCompare(String(b.student_nama || ''))), error: null };
  } catch (e) { return { data: [], error: toError(e) }; }
}

export async function submitAssignment({ assignment, studentId, student, url, note = '' }) {
  try {
    if (!validDriveUrl(url)) throw new Error('Masukkan link Google Drive atau Google Docs yang valid.');
    if (note.length > 1000) throw new Error('Catatan maksimal 1000 karakter.');
    const assignmentSnap = await getDoc(doc(db, 'assignments', assignment.id));
    if (!assignmentSnap.exists() || assignmentSnap.data().status !== 'terbit') throw new Error('Tugas belum tersedia.');
    const a = assignmentSnap.data();
    const refDoc = doc(db, 'submissions', submissionId(assignment.id, studentId));
    const existing = await getDoc(refDoc);
    if (existing.exists() && existing.data().status !== 'perlu_revisi') throw new Error('Tugas sudah dikumpulkan.');
    if (!existing.exists() && Date.now() > new Date(a.deadline).getTime()) throw new Error('Tenggat pengumpulan telah berakhir.');
    const payload = { submission_url: url.trim(), student_note: note.trim(), status: 'dikumpulkan', submitted_at: serverTimestamp() };
    if (existing.exists()) await updateDoc(refDoc, payload);
    else await setDoc(refDoc, { ...payload, assignment_id: assignment.id, class_id: a.class_id, teacher_id: a.teacher_id, student_id: studentId, student_nama: profileName(student), nilai: null, catatan_guru: '' });
    const snap = await getDoc(refDoc);
    return { data: docToObject(snap), error: null };
  } catch (e) { return { data: null, error: toError(e) }; }
}

export async function gradeSubmission({ submissionId: id, nilai, catatan, status }) {
  try {
    if (status === 'dinilai' && (nilai === '' || nilai == null || !Number.isFinite(Number(nilai)) || Number(nilai) < 0 || Number(nilai) > 100)) {
      throw new Error('Masukkan nilai antara 0 sampai 100 sebelum menyimpan penilaian.');
    }
    await updateDoc(doc(db, 'submissions', id), {
      nilai: status === 'perlu_revisi' || nilai === '' || nilai == null ? null : Number(nilai), catatan_guru: catatan.trim(),
      status: status || (nilai === '' || nilai == null ? 'perlu_revisi' : 'dinilai'), updated_at: serverTimestamp(),
    });
    return { data: null, error: null };
  } catch (e) { return { data: null, error: toError(e) }; }
}

export function currentStudentId() { return auth.currentUser?.uid || null; }
