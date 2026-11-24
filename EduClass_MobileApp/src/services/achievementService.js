import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../core/firebase';
import { fetchStudentAssignments } from './assignmentService';
const time = v => v?.toMillis?.() ?? (typeof v === 'string' ? Date.parse(v) : NaN);
const ordered = rows => [...rows].sort((a,b) => (time(a.updated_at) || time(a.submitted_at) || 0) - (time(b.updated_at) || time(b.submitted_at) || 0) || a.id.localeCompare(b.id));
export function streak(rows, test) { let current=0,best=0; for(const row of rows){current=test(row)?current+1:0;best=Math.max(best,current);} return {current,best}; }
const badge=(name,icon,tier,description,value,target)=>({name,icon,tier,description,value,target,unlocked:value>=target});
const own=async (name,field,uid)=>(await getDocs(query(collection(db,name),where(field,'==',uid)))).docs.map(d=>({...d.data(),id:d.id}));
export async function getAchievements(uid,role){
 if(role==='guru'){
  const [classes,assignments,subs]=await Promise.all([own('classes','teacher_id',uid),own('assignments','teacher_id',uid),own('submissions','teacher_id',uid)]);
  const meetings=(await Promise.all(classes.map(c=>own('meetings','class_id',c.id)))).flat();
  const graded=subs.filter(s=>s.status==='dinilai'&&typeof s.nilai==='number').length;
  const completed=meetings.filter(m=>Number.isFinite(Date.parse(`${m.tanggal}T${m.jam_selesai}`))&&Date.parse(`${m.tanggal}T${m.jam_selesai}`)<Date.now()).length;
  const badges=[badge('First Class','school','Common','Buat 1 kelas',classes.length,1),badge('Knowledge Maker','book','Rare','Terbitkan 10 tugas',assignments.filter(a=>a.status==='terbit').length,10),badge('Dedicated Teacher','clipboard','Rare','Nilai 25 pengumpulan',graded,25),badge('Consistent Educator','calendar','Epic','20 pertemuan melewati jam selesai',completed,20),badge('Master Educator','medal','Legendary','Nilai 100 pengumpulan',graded,100)];
  badges.push(badge('EduClass Mentor','trophy','Legendary','Buka 5 badge lainnya',badges.filter(b=>b.unlocked).length,5));return {badges};
 }
 const [subs,attendance,assignments]=await Promise.all([own('submissions','student_id',uid),own('attendance','student_id',uid),fetchStudentAssignments(uid)]);
 if(assignments.error)throw assignments.error;
 const grades=ordered(subs.filter(s=>s.status==='dinilai'&&typeof s.nilai==='number'&&Number.isFinite(s.nilai)));
 const perfect=grades.filter(s=>s.nilai===100).length, scores=streak(grades,s=>s.nilai===100);
 const deadlines=new Map(assignments.data.map(a=>[a.id,time(a.deadline_at)||time(a.deadline)]));
 const timely=ordered(subs.filter(s=>Number.isFinite(deadlines.get(s.assignment_id))&&Number.isFinite(time(s.submitted_at))).map(s=>({...s,updated_at:s.submitted_at})));
 const onTime=s=>time(s.submitted_at)<=deadlines.get(s.assignment_id);
 const avg=grades.length?grades.reduce((n,s)=>n+s.nilai,0)/grades.length:0;
 const badges=[badge('First Step','flag','Common','Kumpulkan tugas pertama',subs.length,1),badge('Perfect Score','checkmark-circle','Common','Raih nilai 100 pertama',perfect,1),badge('On Time','time','Common','3 pengumpulan tepat waktu',timely.filter(onTime).length,3),badge('Task Hunter','book','Rare','Kumpulkan 10 tugas',subs.length,10),badge('Perfect Streak','flame','Rare','3 nilai 100 berturut-turut',scores.best,3),badge('Always Present','calendar','Rare','Hadir di 5 pertemuan',attendance.filter(a=>a.status==='hadir').length,5),badge('Unstoppable','flash','Epic','5 nilai 100 berturut-turut',scores.best,5),badge('Deadline Master','shield-checkmark','Epic','10 pengumpulan berturut-turut tepat waktu',streak(timely,onTime).best,10),badge('High Achiever','trending-up','Epic','Rata-rata ≥90 dari minimal 10 nilai',avg>=90?grades.length:0,10),badge('Perfect Ten','ribbon','Legendary','10 nilai 100 secara keseluruhan',perfect,10),badge('Academic Legend','diamond','Legendary','10 nilai 100 berturut-turut',scores.best,10)];
 badges.push(badge('EduClass Champion','trophy','Legendary','Buka 11 badge lainnya',badges.filter(b=>b.unlocked).length,11));return {badges,scores,avg};
}
