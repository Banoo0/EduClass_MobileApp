import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import useChatInbox from '../hooks/useChatInbox';
import { fetchReminderData } from '../utils/notificationScheduler';
const Context = createContext(null);
const stamp = m => m?.created_at?.toMillis?.() || 0;
const entryKey = x => JSON.stringify([x.id,x.title,x.body, x.id.startsWith('tomorrow') ? '' : x.date]);
const storageKey = uid => `educlass:read:v1:${uid}`;
let queue = Promise.resolve();
export function UnreadProvider({children}) {
 const {user,role}=useAuth(); const uid=user?.uid;
 return <UnreadAccount key={`${uid||''}:${role||''}`} uid={uid} role={role}>{children}</UnreadAccount>;
}
function UnreadAccount({uid,role,children}) {
 const inbox=useChatInbox(uid,role,!!uid);
 const [read,setRead]=useState(null),[academic,setAcademic]=useState([]);
 useEffect(()=>{let live=true; if(!uid)return; AsyncStorage.getItem(storageKey(uid)).then(v=>{if(live){let parsed;try{parsed=JSON.parse(v||'null');}catch{}setRead({chat:parsed?.chat||{},academic:parsed?.academic||{}});}}).catch(()=>{if(live)setRead({chat:{},academic:{}});});return()=>{live=false;};},[uid]);
 useEffect(()=>{if(!uid||!read)return; const value=JSON.stringify(read);queue=queue.catch(()=>{}).then(()=>AsyncStorage.setItem(storageKey(uid),value)).catch(()=>{});},[uid,read]);
 useEffect(()=>{if(!uid||!['guru','siswa'].includes(role))return;let live=true,busy=false;const load=async()=>{if(busy||AppState.currentState==='background')return;busy=true;try{const d=await fetchReminderData(uid,role);if(live)setAcademic(d.entries);}catch{}finally{busy=false;}};load();const timer=setInterval(load,90000);const sub=AppState.addEventListener('change',s=>{if(s==='active')load();});return()=>{live=false;clearInterval(timer);sub.remove();};},[uid,role]);
 const markChat=useCallback((classId,studentId,messages)=>{const ids=messages.filter(m=>m.sender_id!==uid && stamp(m)>0).map(m=>m.id);if(!ids.length)return;const key=`${classId}_${studentId}`;setRead(old=>{if(!old)return old;const prev=old.chat[key]||[];const next=[...new Set([...prev,...ids])].slice(-300);if(next.length===prev.length&&next.every((x,i)=>x===prev[i]))return old;return {...old,chat:{...old.chat,[key]:next}};});},[uid]);
 const markAcademic=useCallback((entries)=>{setRead(old=>{if(!old)return old;const next={...old.academic};for(const x of entries)next[x.id]=entryKey(x);return {...old,academic:next};});},[]);
 const rows=useMemo(()=>inbox.rows.map(r=>({...r,unread:read?(r.messages||[]).filter(m=>m.sender_id!==uid&&stamp(m)>0&&!(read.chat[r.id]||[]).includes(m.id)).length:0})),[inbox.rows,read,uid]);
 const chatCount=rows.reduce((n,r)=>n+r.unread,0);
 const isAcademicUnread=x=>!!read&&read.academic[x.id]!==entryKey(x);
 const academicCount=academic.filter(isAcademicUnread).length;
 return <Context.Provider value={{...inbox,rows,chatCount,academicCount,total:chatCount+academicCount,readReady:!!read,markChat,markAcademic,isAcademicUnread,setAcademic}}>{children}</Context.Provider>;
}
export function useUnread(){return useContext(Context);}
