import { fetchStudentAssignments, fetchTeacherAssignments, fetchAssignmentSubmissions } from '../services/assignmentService';
import { fetchStudentSchedules, fetchTeacherSchedules } from '../services/classServices';

const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const label = d => d.toLocaleDateString('id-ID', { day:'numeric',month:'long',year:'numeric' });
const dateOf = v => new Date(v?.toDate ? v.toDate() : v);
const atEvening = (date, offset) => { const d = new Date(date); d.setDate(d.getDate()-offset); d.setHours(19,0,0,0); return d; };
export async function fetchReminderData(uid, role, now = new Date()) {
  const entries = [], reminders = [];
  const add = (id,title,body,date) => entries.push({id,title,body,date: date ? dateOf(date).getTime() : 0});
  if (role === 'guru') {
    const result = await fetchTeacherAssignments(uid); if(result.error) throw result.error;
    const lists = await Promise.all((result.data || []).map(async a => {
      const r = await fetchAssignmentSubmissions(a.id); if(r.error) throw r.error;
      return (r.data || []).map(s => ({a,s}));
    }));
    for(const {a,s} of lists.flat()) if(s.status === 'dikumpulkan') add(`sub-${s.id}`, 'Pengumpulan perlu diperiksa', `${s.student_nama || 'Siswa'} • ${a.judul}`, s.submitted_at);
    const schedules = await fetchTeacherSchedules(uid);
    if(schedules.error) throw schedules.error;
    for(let i=1;i<=14;i++) {
      const date=new Date(now); date.setDate(date.getDate()+i);
      const lessons=(schedules.data||[]).filter(x=>x.hari===days[date.getDay()]);
      if(!lessons.length) continue;
      const title='Jadwal mengajar besok';
      const body=`${label(date)} • ${lessons.map(x=>`${x.classes?.nama_mapel||x.judul||'Pelajaran'} ${x.classes?.rombel||''} ${x.jam_mulai||''}`).join(', ')}`;
      const trigger=atEvening(date,1);
      if(i===1) add('tomorrow-teacher',title,body,now);
      if(trigger>now) reminders.push({id:`teacher-schedule-${label(date)}`,title,body,date:trigger});
    }
  } else {
    const [a,s] = await Promise.all([fetchStudentAssignments(uid),fetchStudentSchedules(uid)]);
    if(a.error) throw a.error; if(s.error) throw s.error;
    for(const task of a.data || []) {
      const sub = task.submission; const due = dateOf(task.deadline_at || task.deadline);
      if(sub?.status === 'dinilai') add(`grade-${task.id}`, 'Tugas sudah dinilai', `${task.judul} • Nilai ${sub.nilai ?? '-'}`, sub.updated_at || sub.submitted_at);
      else if(sub?.status === 'perlu_revisi') add(`revision-${task.id}`, 'Perlu revisi', task.judul, sub.updated_at || sub.submitted_at);
      else if(!sub) {
        add(`task-${task.id}`, 'Tugas belum dikumpulkan', task.judul, task.created_at);
        if(Number.isFinite(due.getTime()) && due > now) for(const offset of [7,5,3]) {
          const date = atEvening(due,offset); const title = `Pengingat tugas H-${offset}`; const body = `${task.judul} • Tenggat ${label(due)}`;
          if(date > now) reminders.push({id:`task-${task.id}-${offset}`,title,body,date});
          else if(date.toDateString() === now.toDateString()) add(`due-${task.id}-${offset}`,title,body,date);
        }
      }
    }
    for(let i=1;i<=14;i++) {
      const date = new Date(now); date.setDate(date.getDate()+i);
      const lessons = (s.data || []).filter(x => x.hari === days[date.getDay()]);
      if(!lessons.length) continue;
      const title = 'Jadwal pelajaran besok'; const body = `${label(date)} • ${lessons.map(x=>`${x.classes?.nama_mapel || x.judul || 'Pelajaran'} ${x.jam_mulai || ''}`).join(', ')}`;
      const trigger = atEvening(date,1);
      if(i===1) add('tomorrow',title,body,now);
      if(trigger > now) reminders.push({id:`schedule-${label(date)}`,title,body,date:trigger});
    }
  }
  return {entries: entries.sort((a,b)=>(b.date||0)-(a.date||0)), reminders: reminders.sort((a,b)=>a.date-b.date)};
}
