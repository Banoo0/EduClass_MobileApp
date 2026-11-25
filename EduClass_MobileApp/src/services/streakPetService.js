import { getAchievements } from './achievementService';
import { fetchStudentAssignments } from './assignmentService';
import { fetchStudentWeekMeetings } from './meetingService';

export const stages = [
  { name: 'Rookie', min: 0, next: 3 },
  { name: 'Adventurer', min: 3, next: 6 },
  { name: 'Knight', min: 6, next: 10 },
  { name: 'Royal Guardian', min: 10, next: null },
];
export function stageFor(count) { return count >= 10 ? 3 : count >= 6 ? 2 : count >= 3 ? 1 : 0; }
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const asDate = v => v ? (v.toDate ? v.toDate() : new Date(v)) : null;
export function petReminder(tasks, meetings, now = new Date()) {
  const pending = tasks.filter(t => !t.submission || t.submission.status === 'perlu_revisi');
  const deadlines = pending.map(t => ({ t, due: asDate(t.deadline_at || t.deadline) })).filter(x => x.due && Number.isFinite(x.due.getTime()));
  const future = deadlines.filter(x => x.due >= now).sort((a,b) => a.due-b.due);
  const urgent = future[0];
  if (urgent && urgent.due-now <= 3*86400000) {
    const when = dayKey(urgent.due) === dayKey(now) ? 'hari ini' : `tanggal ${urgent.due.toLocaleDateString('id-ID',{day:'numeric',month:'short'})}`;
    return { text: `Meow! ${urgent.t.judul || 'Tugasmu'} tenggat ${when}.`, mood: 'alert' };
  }
  const revision = pending.find(t => t.submission?.status === 'perlu_revisi');
  if (revision) return { text: `Ada revisi untuk ${revision.judul || 'tugasmu'}. Yuk cek!`, mood: 'alert' };
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate()+1);
  const next = meetings.filter(m => String(m.tanggal||'').slice(0,10) === dayKey(tomorrow));
  if (next.length) return { text: `Besok ada ${next.length} pertemuan. Siapkan dirimu, meow!`, mood: 'happy' };
  if (urgent) return { text: `Ada ${future.length} tugas dengan tenggat mendatang. Kerjakan sedikit demi sedikit!`, mood: 'happy' };
  if (pending.length) return { text: 'Ada tugas yang belum selesai. Cek daftar tugasmu, ya!', mood: 'alert' };
  return { text: 'Tidak ada tugas tertunda. Nikmati waktu istirahatmu, meow!', mood: 'happy' };
}
export async function loadStreakPet(uid, now = new Date()) {
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate()+1);
  const [a,t,m] = await Promise.all([getAchievements(uid,'siswa'), fetchStudentAssignments(uid), fetchStudentWeekMeetings({ studentId:uid, weekStartKey:dayKey(now), weekEndKey:dayKey(tomorrow) })]);
  if (t.error) throw t.error;
  if (m.error) throw m.error;
  const count = a.badges.filter(b => b.unlocked).length;
  return { count, total:a.badges.length, stage:stageFor(count), streak:a.scores?.current || 0, reminder:petReminder(t.data || [], m.data?.meetings || [], now) };
}
