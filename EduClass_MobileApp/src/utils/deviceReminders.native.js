import * as N from 'expo-notifications';
import { Platform } from 'react-native';
N.setNotificationHandler({handleNotification: async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});
const channelId='educlass-reminders';
async function prepare() {
  let channel;
  if (Platform.OS==='android') {
    try {
      await N.setNotificationChannelAsync(channelId,{name:'Pengingat EduClass',importance:N.AndroidImportance.DEFAULT});
      channel=channelId;
    } catch(e) {
      if (!String(e.message).includes('NullPointerException')) throw e;
      // Expo Go SDK 58 channel bridge issue: try the default channel instead.
    }
  }
  let permission=await N.getPermissionsAsync();
  if(!permission.granted) permission=await N.requestPermissionsAsync();
  if(!permission.granted) throw new Error('Izin notifikasi belum diberikan. Aktifkan notifikasi Expo Go di pengaturan HP. Jika masih gagal, gunakan development build.');
  return channel;
}
async function schedule(r,channel) {
  return N.scheduleNotificationAsync({content:{title:r.title,body:r.body,data:{educlassReminder:true}},trigger:{type:N.SchedulableTriggerInputTypes.DATE,date:r.date,...(channel?{channelId:channel}:{})}});
}
export async function clearDeviceReminders() {
  const all=await N.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter(x=>x.content.data?.educlassReminder===true).map(x=>N.cancelScheduledNotificationAsync(x.identifier)));
}
export async function syncDeviceReminders(reminders) {
  const channel=await prepare();
  await clearDeviceReminders();
  let count=0;
  for(const r of reminders.filter(x=>x.date>Date.now()).slice(0,60)) { await schedule(r,channel); count++; }
  return count;
}
export async function testDeviceReminder() {
  const channel=await prepare();
  return schedule({title:'Tes EduClass',body:'Notifikasi lokal berhasil diterima.',date:new Date(Date.now()+15000)},channel);
}
