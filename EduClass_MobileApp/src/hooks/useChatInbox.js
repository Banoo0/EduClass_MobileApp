import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, orderBy, query, limit, where } from 'firebase/firestore';
import { db } from '../core/firebase';

export default function useChatInbox(uid, role, enabled = true) {
  const [data,setData]=useState({rows:[],loading:true,error:''});
  useEffect(()=>{
    setData({rows:[],loading:!!(enabled&&uid),error:''});
    if(!enabled||!uid||!['guru','siswa'].includes(role)) return;
    let active=true, generation=0, stops=[];
    const fail=e=>{if(active)setData(old=>({...old,loading:false,error:e.message||'Chat gagal dimuat.'}));};
    const teacher=role==='guru';
    const q=query(collection(db,'class_members'),where(teacher?'teacher_id':'student_id','==',uid));
    const stop=onSnapshot(q,async snap=>{
      const g=++generation;
      stops.forEach(fn=>fn()); stops=[];
      try {
        const members=snap.docs.map(d=>d.data());
        const classes=await Promise.all([...new Set(members.map(m=>m.class_id))].map(async id=>[id,await getDoc(doc(db,'classes',id))]));
        if(!active||g!==generation)return;
        const map=new Map(classes.filter(([,d])=>d.exists()).map(([id,d])=>[id,d.data()]));
        const rows=members.filter(m=>map.has(m.class_id)).map(m=>{
          const c=map.get(m.class_id);
          return {id:`${m.class_id}_${m.student_id}`,classId:m.class_id,studentId:m.student_id,name:teacher?m.student_nama||'Siswa':c.teacher_nama||'Guru pengampu',label:[c.nama_mapel,c.rombel].filter(Boolean).join(' • '),latest:null,incoming:null};
        });
        setData({rows,loading:false,error:''});
        for(const r of rows){
          const mq=query(collection(db,'classes',r.classId,'private_chats',r.studentId,'messages'),orderBy('created_at','desc'),limit(20));
          stops.push(onSnapshot(mq,ms=>{
            if(!active||g!==generation)return;
            const msgs=ms.docs.map(d=>({id:d.id,...d.data()}));
            setData(old=>({...old,rows:old.rows.map(x=>x.id===r.id?{...x,messages:msgs,latest:msgs[0]||null,incoming:msgs.find(m=>m.sender_id!==uid)||null}:x)}));
          },fail));
        }
      }catch(e){if(g===generation)fail(e);}
    },fail);
    return ()=>{active=false;generation++;stop();stops.forEach(fn=>fn());};
  },[uid,role,enabled]);
  return data;
}
