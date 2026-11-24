import { useAppTheme } from '../context/ThemeContext';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../core/theme';
const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

export default function MonthlyCalendar({ selectedDateKey, onChange, schedules = [], dateMarkers = {} }) {
  const { colors, mode: appThemeMode } = useAppTheme();
  const styles = make_styles(colors);

  const [y,m,d] = selectedDateKey.split('-').map(Number);
  const [picker,setPicker] = useState(null);
  const [width,setWidth] = useState(0);
  const { width: screenWidth } = useWindowDimensions();
  const compact = screenWidth < 600 || (width > 0 && width < 500);
  const gap = compact ? 5 : 10;
  const ref = useRef(null), offset = useRef(0);
  const count = new Date(y,m,0).getDate();
  const visible = Math.max(1,Math.min(compact ? 5 : 7,Math.floor((width+gap)/((compact ? 54 : 86)+gap))));
  const cardWidth = width ? Math.min(compact ? 76 : 112, Math.floor((width-(visible-1)*gap)/visible)) : (compact ? 62 : 100);
  const move = x => ref.current?.scrollTo({x:Math.max(0,Math.min(x,count*(cardWidth+gap)-gap-width)),animated:false});
  useEffect(() => { if (!width) return; const x=(d-1)*(cardWidth+gap); if(x<offset.current) move(x); else if(x+cardWidth>offset.current+width) move(x+cardWidth-width); },[selectedDateKey,width,cardWidth,gap]);
  useEffect(() => { if(Platform.OS!=='web') return; const node=ref.current?.getScrollableNode?.(); if(!node?.addEventListener)return; const wheel=e=>{if(e.ctrlKey||Math.abs(e.deltaX)>=Math.abs(e.deltaY))return; const x=Math.max(0,Math.min(node.scrollWidth-node.clientWidth,node.scrollLeft+e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?node.clientWidth:1))); if(x!==node.scrollLeft){e.preventDefault();node.scrollLeft=x;}}; node.addEventListener('wheel',wheel,{passive:false}); return ()=>node.removeEventListener('wheel',wheel); },[width]);
  const options = picker==='month'?months.map((label,i)=>({label,value:i+1})):Array.from({length:21},(_,i)=>({label:String(new Date().getFullYear()-10+i),value:new Date().getFullYear()-10+i}));
  const btn=(label,action,icon)=> <Pressable accessibilityRole="button" onPress={action} style={[styles.button, compact && {padding:8,minHeight:36}, !label && compact && {paddingHorizontal:5}]}><Text style={styles.text}>{label}</Text>{icon?<Ionicons name={icon} size={16} color={colors.text}/>:null}</Pressable>;
  return <View style={{gap:12}}>
    <View style={styles.controls}>{btn(months[m-1],()=>setPicker('month'),'chevron-down')}{btn(String(y),()=>setPicker('year'),'chevron-down')}{btn('Hari ini',()=>onChange(key(new Date())))}</View>
    <View style={[styles.controls, compact && {gap:4}]}>{!compact && btn('',()=>move(offset.current-width),'chevron-back')}<View style={{flex:1,minWidth:0}} onLayout={e=>setWidth(e.nativeEvent.layout.width)}><ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} onScroll={e=>{offset.current=e.nativeEvent.contentOffset.x}} scrollEventThrottle={16} contentContainerStyle={{gap}}>{Array.from({length:count},(_,i)=>{const date=new Date(y,m-1,i+1), k=key(date), active=k===selectedDateKey, day=days[date.getDay()];return <Pressable key={k} onPress={()=>onChange(k)} style={[styles.day,{width:cardWidth,height:cardWidth,flexShrink:0},compact && {borderRadius:9,gap:2},active&&styles.active]}><Text style={[styles.dayName,compact && {fontSize:12},active&&styles.selected]}>{compact ? day.slice(0,3) : day}</Text><Text style={[styles.number,compact && {fontSize:22},active&&styles.selected]}>{i+1}</Text><View style={{flexDirection:'row',gap:compact?2:3,height:8,alignItems:'center'}}>{[...new Set([...(schedules.some(j=>String(j.hari).trim().toLowerCase()===day.toLowerCase())?[colors.primary]:[]),...(dateMarkers[k]||[])])].map(color=><View key={color} style={{width:compact?5:7,height:compact?5:7,borderRadius:4,backgroundColor:active&&color===colors.primary?'#fff':color}}/>)}</View></Pressable>})}</ScrollView></View>{!compact && btn('',()=>move(offset.current+width),'chevron-forward')}</View>
    <Modal transparent visible={!!picker} animationType="fade" onRequestClose={()=>setPicker(null)}><View style={styles.overlay}><View style={styles.dialog}><Text style={styles.number}>{picker==='month'?'Pilih bulan':'Pilih tahun'}</Text><ScrollView>{options.map(o=><Pressable key={o.value} style={styles.option} onPress={()=>{onChange(key(picker==='month'?new Date(y,o.value-1,1):new Date(o.value,m-1,1)));setPicker(null)}}><Text style={styles.text}>{o.label}</Text></Pressable>)}</ScrollView>{btn('Tutup',()=>setPicker(null))}</View></View></Modal>
  </View>;
}
const make_styles = (colors) => (StyleSheet.create({controls:{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'nowrap'},button:{padding:10,minHeight:42,borderRadius:10,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},text:{color:colors.text,fontWeight:'600'},day:{height:90,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,alignItems:'center',justifyContent:'center',gap:5},active:{backgroundColor:colors.primary,borderColor:colors.primary},dayName:{color:colors.textMuted,fontSize:13},number:{color:colors.text,fontSize:24,fontWeight:'700'},selected:{color:'#fff'},overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.65)',justifyContent:'center',alignItems:'center',padding:20},dialog:{width:'100%',maxWidth:360,maxHeight:'75%',backgroundColor:colors.card,borderRadius:16,padding:16,gap:12},option:{padding:14,borderBottomWidth:1,borderBottomColor:colors.border}}));
