import { auth } from '../core/firebase';
import { fetchStudentClasses, fetchStudentSchedules, fetchTeacherClasses, fetchTeacherSchedules } from './classServices';
import { fetchStudentAssignments, fetchTeacherAssignments, fetchAssignmentSubmissions } from './assignmentService';
import { namaHariIni } from '../utils/dateHelper';

function unwrap(result) { if (result.error) throw result.error; return result.data || []; }
function normalizeSchedule(j, klass) {
  const c = klass || j.classes || {};
  return { ...j, kelas: { ...c, guru: { nama_lengkap: c.teacher_nama || j.teacher_nama || '' } }, ruangan: [j.ruang, j.gedung].filter(Boolean).join(' • ') || j.ruangan || '' };
}
const today = j => String(j.hari || '').toLowerCase() === namaHariIni().toLowerCase();
export async function getStudentDashboard(studentId = auth.currentUser?.uid) {
  try {
    if (!studentId) throw new Error('Akun siswa tidak ditemukan.');
    const [classes, schedules, assignments] = (await Promise.all([fetchStudentClasses(studentId), fetchStudentSchedules(studentId), fetchStudentAssignments(studentId)])).map(unwrap);
    const active = classes.filter(c => c.aktif !== false);
    const map = new Map(active.map(c => [c.id, c]));
    return { data: { kelas: active, jadwal: schedules.filter(j => map.has(j.class_id) && today(j)).map(j => normalizeSchedule(j, map.get(j.class_id))), tugas: assignments.filter(t => map.has(t.class_id)).map(t => ({ ...t, kelas: { ...t.class, guru: { nama_lengkap: t.teacher_nama || t.class?.teacher_nama || '' } }, keterangan: t.deskripsi, status_pengumpulan: t.submission?.status || null })) }, error: null };
  } catch (error) { return { data: null, error }; }
}
export async function getTeacherDashboard(teacherId = auth.currentUser?.uid) {
  try {
    if (!teacherId) throw new Error('Akun guru tidak ditemukan.');
    const [classes, schedules, assignments] = (await Promise.all([fetchTeacherClasses(teacherId), fetchTeacherSchedules(teacherId), fetchTeacherAssignments(teacherId)])).map(unwrap);
    const active = classes.filter(c => c.aktif !== false);
    const map = new Map(active.map(c => [c.id, c]));
    const tasks = assignments.filter(t => t.status === 'terbit' && map.has(t.class_id));
    const tugas = await Promise.all(tasks.map(async t => ({ ...t, kelas: { ...t.class, jumlah_siswa: t.studentCount ?? map.get(t.class_id)?.jumlah_siswa ?? 0 }, pengumpulan: unwrap(await fetchAssignmentSubmissions(t.id)) })));
    return { data: { kelas: active, jadwal: schedules.filter(j => map.has(j.class_id) && today(j)).map(j => normalizeSchedule(j, map.get(j.class_id))), tugas }, error: null };
  } catch (error) { return { data: null, error }; }
}
