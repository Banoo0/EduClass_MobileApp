import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Keyboard, KeyboardAvoidingView, Image, Platform, ScrollView, Modal, PanResponder, Pressable, StyleSheet, Text, View, TextInput, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { loadStreakPet, stages } from '../services/streakPetService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WarriorSprite from './WarriorSprite';
import { usePetPanel } from './PetPanelContext';
const galleryImages = [require('./streakpet/rookie_1.png'), require('./streakpet/adventurer_1.png'), require('./streakpet/knight_1.png'), require('./streakpet/guardian_1.png')];
export function EvolutionGallery({stage, count, colors}) {
  const [page,setPage]=useState(stage);
  const [reduceMotion,setReduceMotion]=useState(false);
  const swipeStart=useRef(null);
  const swipeEnd=useRef(null);
  useEffect(()=>{setPage(stage);},[stage]);
  useEffect(()=>{let alive=true;AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(alive)setReduceMotion(v);}).catch(()=>{});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);return()=>{alive=false;sub.remove();};},[]);
  const go=delta=>setPage(p=>Math.max(0,Math.min(stages.length-1,p+delta)));
  const item=stages[page], locked=page>stage, current=page===stage;
  const fraction=locked?Math.max(0,Math.min(1,(count??0)/Math.max(1,item.min))):1;
  const arrow=(delta,icon,label)=><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={delta<0?page===0:page===stages.length-1} onPress={()=>go(delta)} hitSlop={8} style={{width:36,height:44,justifyContent:'center',alignItems:'center',opacity:(delta<0?page===0:page===stages.length-1)?0.2:1}}><Ionicons name={icon} size={28} color={colors.text}/></Pressable>;
  return <View style={{gap:10,marginTop:6}}>
    <View style={s.row}><Text style={{color:colors.text,fontSize:16,fontWeight:'800'}}>Evolution Gallery</Text><Text style={{color:colors.textMuted,fontSize:12}}>{stage+1}/{stages.length} terbuka</Text></View>
    <View style={{alignItems:'center',gap:4}}>
      <Text style={{color:colors.primary,fontSize:12,fontWeight:'800',letterSpacing:1}}>LV. {page+1}</Text>
      <Text style={{color:colors.text,fontSize:20,fontWeight:'800'}}>{locked?'???':item.name}</Text>
      <View style={{flexDirection:'row',alignItems:'center',width:'100%',justifyContent:'space-between'}}>
        {arrow(-1,'chevron-back','Evolusi sebelumnya')}
        <View style={{flex:1,minWidth:0,height:208,alignItems:'center',justifyContent:'center',touchAction:Platform.OS==='web'?'pan-y':undefined}} onStartShouldSetResponder={()=>false} onMoveShouldSetResponder={e=>{if(Platform.OS==='web')return false;const p=e.nativeEvent;const start=swipeStart.current;return !!start&&Math.abs(p.pageX-start.x)>12&&Math.abs(p.pageX-start.x)>Math.abs(p.pageY-start.y)*1.25;}} onTouchStart={e=>{if(Platform.OS==='web')return;swipeStart.current={x:e.nativeEvent.pageX,y:e.nativeEvent.pageY};swipeEnd.current=swipeStart.current;}} onTouchMove={e=>{if(Platform.OS==='web')return;swipeEnd.current={x:e.nativeEvent.pageX,y:e.nativeEvent.pageY};}} onTouchEnd={()=>{if(Platform.OS==='web')return;const start=swipeStart.current,end=swipeEnd.current;swipeStart.current=null;swipeEnd.current=null;if(start&&end&&Math.abs(end.x-start.x)>35&&Math.abs(end.x-start.x)>Math.abs(end.y-start.y)*1.25)go(end.x<start.x?1:-1);}} onTouchCancel={()=>{swipeStart.current=null;swipeEnd.current=null;}} {...(Platform.OS==='web'?{onPointerDown:e=>{swipeStart.current={x:e.nativeEvent.pageX,y:e.nativeEvent.pageY};},onPointerUp:e=>{const start=swipeStart.current;swipeStart.current=null;if(start&&Math.abs(e.nativeEvent.pageX-start.x)>35&&Math.abs(e.nativeEvent.pageX-start.x)>Math.abs(e.nativeEvent.pageY-start.y)*1.25)go(e.nativeEvent.pageX<start.x?1:-1);}}:{})}>
          <View pointerEvents="none" style={{position:'absolute',bottom:17,width:'80%',maxWidth:170,height:23,borderRadius:100,backgroundColor:colors.primary,opacity:0.12}}/>
          {locked?<Image source={galleryImages[page]} resizeMode="contain" style={{width:'100%',maxWidth:200,height:190,tintColor:colors.textMuted,opacity:0.6}}/>:<WarriorSprite key={page} stage={page} size={170} active reduce={reduceMotion}/>}
        </View>
        {arrow(1,'chevron-forward','Evolusi berikutnya')}
      </View>
      <View style={{flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center'}}>{stages.map((_,i)=><Pressable key={i} accessibilityRole="button" accessibilityLabel={`Lihat level ${i+1}`} accessibilityState={{selected:i===page}} onPress={()=>setPage(i)} hitSlop={6} style={{paddingVertical:6}}><View style={{width:i===page?20:7,height:7,borderRadius:5,backgroundColor:i===page?colors.primary:colors.textMuted,opacity:i===page?1:0.4}}/></Pressable>)}</View>
      <View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name={locked?'lock-closed-outline':current?'star':'checkmark-circle'} size={15} color={locked?colors.textMuted:colors.primary}/><Text style={{color:current?colors.primary:colors.textMuted,fontWeight:'600',fontSize:12}}>{current?'Evolusi aktif':locked?'Belum terbuka':'Terbuka'}</Text></View>
    </View>
    <View style={{gap:5,marginHorizontal:12}}><View style={s.row}><Text style={{color:colors.textMuted,fontSize:12}}>{locked?'Progress evolusi':'Syarat evolusi tercapai'}</Text><Text style={{color:colors.text,fontSize:12,fontWeight:'700'}}>{locked?(typeof count==='number'?`${Math.min(count,item.min)}/${item.min} badge`:`${item.min} badge diperlukan`):`${item.min} badge`}</Text></View><View style={[s.track,{backgroundColor:colors.border}]}><View style={{height:6,borderRadius:4,width:`${fraction*100}%`,backgroundColor:colors.primary}}/></View>{locked&&typeof count==='number'?<Text style={[s.center,{color:colors.textMuted}]}>{Math.max(0,item.min-count)} badge lagi untuk membuka evolusi ini.</Text>:null}</View>
    <Text style={[s.center,{color:colors.textMuted,fontSize:11}]}>Geser atau tekan panah untuk melihat evolusi lainnya.</Text>
  </View>;
}
export default function StreakPetOverlay({ focused = true }) {
  const { user, role } = useAuth();
  const { colors } = useAppTheme();
  const uid = user?.uid;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const panelContext = usePetPanel();
  const publish = panelContext?.setSnapshot;
  const request = panelContext?.request ?? 0;
  const lastRequest = useRef(request);
  const [position,setPosition] = useState(0);
  const [dragging,setDragging] = useState(false);
  const [side,setSide] = useState(1);
  const [bounds,setBounds] = useState(null);
  const horizontal = useRef(new Animated.Value(1)).current;
  const horizontalRef = useRef(1);
  const sideRef = useRef(1);
  const dragStart = useRef({x:1,y:0});
  const snapRef = useRef(null);
  const reduceRef = useRef(false);
  const snapTo = useCallback((target, animate = true)=>{
    snapRef.current?.stop();
    sideRef.current=target; setSide(target);
    if(!animate || reduceRef.current){horizontalRef.current=target;horizontal.setValue(target);return;}
    const animation=Animated.spring(horizontal,{toValue:target,overshootClamping:true,stiffness:260,damping:28,mass:0.8,useNativeDriver:false,isInteraction:false});
    snapRef.current=animation;animation.start(()=>{if(snapRef.current===animation)snapRef.current=null;});
  },[horizontal]);
  useEffect(()=>{const id=horizontal.addListener(({value})=>{horizontalRef.current=value;});return()=>{snapRef.current?.stop();horizontal.removeListener(id);};},[horizontal]);
  const positionRef = useRef(0);
  const [data,setData] = useState(null), [error,setError] = useState(false), [open,setOpen] = useState(false), [mini,setMini] = useState(false), [keyboard,setKeyboard] = useState(false), [active,setActive] = useState(AppState.currentState !== 'background'), [reduce,setReduce] = useState(false), [bubble,setBubble] = useState('');
  const [petName,setPetName]=useState(''),[nameDraft,setNameDraft]=useState(''),[reaction,setReaction]=useState(0),[highest,setHighest]=useState(0),[prefsReady,setPrefsReady]=useState(false);
  const key=uid?`educlass:warrior:v2:${uid}`:null;
  useEffect(()=>{let valid=true;setPrefsReady(false);setPetName('');setNameDraft('');setHighest(0);setPosition(0);positionRef.current=0;setDragging(false);snapTo(1,false);if(!key)return;AsyncStorage.getItem(key).then(raw=>{if(!valid)return;const p=JSON.parse(raw||'{}');setPetName(typeof p.name==='string'?p.name.slice(0,24):'');setNameDraft(typeof p.name==='string'?p.name.slice(0,24):'');setHighest(Math.max(0,Math.min(3,Number(p.stage)||0)));const pos=Math.max(0,Math.min(1,Number(p.position)||0));positionRef.current=pos;setPosition(pos);snapTo(p.side===0?0:1,false);}).catch(()=>{}).finally(()=>{if(valid)setPrefsReady(true);});return()=>{valid=false;};},[key,snapTo]);
  useEffect(()=>{if(data&&prefsReady)setHighest(v=>Math.max(v,data.stage));},[data,prefsReady]);
  useEffect(()=>{if(key&&prefsReady&&!dragging)AsyncStorage.setItem(key,JSON.stringify({name:petName,stage:highest,position,side})).catch(()=>{});},[key,prefsReady,petName,highest,position,side,dragging]);
  const lift = useRef(new Animated.Value(0)).current;
  const previous = useRef(null), timer = useRef(null), generation = useRef(0), busy = useRef(false);
  const visibleApp = Platform.OS === 'web' || active;
  const show = focused && visibleApp && !keyboard && role === 'siswa' && !!uid;
  const flash = useCallback(text => { clearTimeout(timer.current); setBubble(text); timer.current=setTimeout(()=>setBubble(''),5000); },[]);
  useEffect(()=>{ const a=Keyboard.addListener('keyboardDidShow',()=>setKeyboard(true)), b=Keyboard.addListener('keyboardDidHide',()=>setKeyboard(false)), c=AppState.addEventListener('change',s=>setActive(s==='active')); const d=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce); AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(()=>{}); return ()=>{a.remove();b.remove();c.remove();d.remove();clearTimeout(timer.current);}; },[]);
  useEffect(()=>{generation.current++;busy.current=false;previous.current=null;setData(null);setError(false);setOpen(false);setBubble('');setMini(false);return ()=>{generation.current++;busy.current=false;};},[uid]);
  const refresh = useCallback(async()=>{
    if(!uid || role!=='siswa' || busy.current) return;
    const id=generation.current;busy.current=true;
    try {
      const result=await loadStreakPet(uid);
      if(id!==generation.current) return;
      const old=previous.current;
      setData(result);setError(false);previous.current=result;
      if(old && result.stage>old.stage) flash(`Meow! Aku tumbuh jadi ${stages[result.stage].name}!`);
      else if(old && result.count>old.count) flash('Yay! Kamu mendapat badge baru!');
      else if((!old || old.reminder.text!==result.reminder.text) && result.reminder.mood==='alert') flash(result.reminder.text);
    } catch(e){if(id===generation.current)setError(true);}
    finally {if(id===generation.current)busy.current=false;}
  },[uid,role,flash]);
  useEffect(()=>{if(!focused||!visibleApp||role!=='siswa'||!uid)return;refresh();const i=setInterval(refresh,180000);return ()=>clearInterval(i);},[focused,visibleApp,role,uid,refresh]);
  useEffect(()=>{if(!show||reduce||mini){lift.setValue(0);return;}const loop=Animated.loop(Animated.sequence([Animated.timing(lift,{toValue:1,duration:1300,useNativeDriver:true,isInteraction:false}),Animated.timing(lift,{toValue:0,duration:1300,useNativeDriver:true,isInteraction:false})]));loop.start();return ()=>{loop.stop();lift.setValue(0);};},[show,reduce,mini,lift]);
  useEffect(()=>{if(!focused||!visibleApp)setOpen(false);},[focused,visibleApp]);
  const stage=Math.max(data?.stage??0,highest), info=stages[stage];
  reduceRef.current=reduce;
  const areaWidth=bounds?.width || width, areaHeight=bounds?.height || height;
  const size=mini?36:Math.min(88,Math.max(64,areaWidth*.22));
  const bottomBase=64+Math.max(10,insets.bottom)+14;
  const leftEdge=Math.max(12,insets.left+8), rightEdge=Math.max(12,insets.right+8);
  const travel=Math.max(0,areaHeight-bottomBase-Math.max(95,insets.top+80)-size-30);
  const horizontalTravel=Math.max(0,areaWidth-leftEdge-rightEdge-size);
  const travelRef=useRef(travel);travelRef.current=travel;
  const horizontalTravelRef=useRef(horizontalTravel);horizontalTravelRef.current=horizontalTravel;
  const pan=useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture:(_,g)=>Math.hypot(g.dx,g.dy)>8,
    onPanResponderGrant:()=>{snapRef.current?.stop();dragStart.current={x:horizontalRef.current,y:positionRef.current};setDragging(true);setBubble('');},
    onPanResponderMove:(_,g)=>{
      const x=Math.max(0,Math.min(1,dragStart.current.x+g.dx/Math.max(1,horizontalTravelRef.current)));
      const y=Math.max(0,Math.min(1,dragStart.current.y-g.dy/Math.max(1,travelRef.current)));
      horizontalRef.current=x;horizontal.setValue(x);positionRef.current=y;setPosition(y);
    },
    onPanResponderRelease:(_,g)=>{
      const x=Math.max(0,Math.min(1,dragStart.current.x+g.dx/Math.max(1,horizontalTravelRef.current)));
      const y=Math.max(0,Math.min(1,dragStart.current.y-g.dy/Math.max(1,travelRef.current)));
      positionRef.current=y;setPosition(y);snapTo(x===0.5?sideRef.current:x<0.5?0:1);setDragging(false);
    },
    onPanResponderTerminate:()=>{snapTo(horizontalRef.current<0.5?0:1);setDragging(false);},
    onPanResponderTerminationRequest:()=>false,
  })).current;
  useEffect(()=>{if(publish)publish(uid&&role==='siswa'?{uid,stage,count:data?.count,name:petName}:null);},[publish,uid,role,stage,data?.count,petName]);
  useEffect(()=>{if(request!==lastRequest.current){lastRequest.current=request;if(uid&&role==='siswa'){setOpen(true);setBubble('');refresh();}}},[request,uid,role,refresh]);
  if(!show&&!open)return null;
  const progress=data?(info.next===null?1:Math.max(0,Math.min(1,(data.count-info.min)/(info.next-info.min)))):0;
  return <>
    {show?<View pointerEvents="box-none" onLayout={({nativeEvent:{layout}})=>setBounds(old=>old?.width===layout.width&&old?.height===layout.height?old:{width:layout.width,height:layout.height})} style={s.overlayHost}>
      <Animated.View pointerEvents="box-none" style={[s.overlay,{width:size,bottom:bottomBase+position*travel,left:horizontal.interpolate({inputRange:[0,1],outputRange:[leftEdge,leftEdge+horizontalTravel]}),alignItems:side===0?'flex-start':'flex-end'}]}>
      {!!bubble&&!mini&&!open&&!dragging?<Pressable accessibilityLabel="Tutup pengingat StreakPet" onPress={()=>setBubble('')} style={[s.bubble,{backgroundColor:colors.card,borderColor:colors.border,width:Math.min(210,Math.max(0,areaWidth-leftEdge-rightEdge)),[side===0?'left':'right']:0,...(position>0.65?{top:size+32}:{bottom:size+32})}]}><Text style={{color:colors.text,fontSize:12,lineHeight:17}}>{bubble}</Text></Pressable>:null}
      <View {...pan.panHandlers} style={{touchAction:Platform.OS==='web'?'none':undefined}}>
      <Pressable accessibilityRole="button" accessibilityLabel="Sapa StreakPet; tahan untuk membuka panel" onPress={()=>{setReaction(v=>v+1);flash(data?.reminder.text||'Meow! Siap berpetualang?');}} onLongPress={()=>{setOpen(true);setBubble('');refresh();}} style={[s.petButton,{width:size,height:size}]}>
        <Animated.View style={{transform:[{translateY:lift.interpolate({inputRange:[0,1],outputRange:[0,-5]})}]}}><WarriorSprite stage={stage} size={size} active={show&&!open} reduce={reduce||mini} reaction={reaction}/></Animated.View>
        {data?.reminder.mood==='alert'&&!mini?<View style={[s.dot,{borderColor:colors.bg}]}/>:null}
      </Pressable>
      </View>
      <Pressable accessibilityLabel="Buka panel StreakPet" onPress={()=>{setOpen(true);setBubble('');refresh();}} style={{padding:4,alignSelf:side===0?'flex-start':'flex-end'}}><Ionicons name="ellipsis-horizontal-circle" size={20} color={colors.primary}/></Pressable>
    </Animated.View></View>:null}
    <Modal transparent visible={open} animationType={reduce?'none':'fade'} onRequestClose={()=>setOpen(false)}>
      <KeyboardAvoidingView style={s.scrim} behavior={Platform.OS==='ios'?'padding':Platform.OS==='android'?'height':undefined}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Tutup panel" onPress={()=>setOpen(false)}/>
        <View style={[s.panel,{backgroundColor:colors.card,borderColor:colors.border,marginBottom:Math.max(14,insets.bottom),height:Math.min(720,height*.85)}]}>
          <ScrollView style={{flex:1}} keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:10,paddingBottom:12}}><View style={s.row}><Text style={[s.title,{color:colors.text}]}>StreakPet</Text><Pressable accessibilityRole="button" accessibilityLabel="Tutup StreakPet" onPress={()=>setOpen(false)} hitSlop={10}><Ionicons name="close" size={24} color={colors.textMuted}/></Pressable></View>
          <Pressable accessibilityLabel="Sapa pet" onPress={()=>setReaction(v=>v+1)} style={s.hero}><WarriorSprite stage={stage} size={128} active={open} reduce={reduce} reaction={reaction}/></Pressable>
          <Text style={[s.stage,{color:colors.text}]}>{petName||'StreakPet'}</Text><Text style={[s.center,{color:colors.textMuted}]}>Lv. {stage+1} · {info.name}</Text><View style={s.row}><TextInput accessibilityLabel="Nama pet" placeholder="Nama pet (opsional)" placeholderTextColor={colors.textMuted} value={nameDraft} onChangeText={setNameDraft} maxLength={24} style={{flex:1,color:colors.text,backgroundColor:colors.cardAlt,padding:10,borderRadius:10}}/><Pressable onPress={()=>setPetName(nameDraft.trim())} style={s.action}><Text style={{color:colors.primary,fontWeight:'700'}}>Simpan</Text></Pressable></View>
          {data?<><Text style={[s.center,{color:colors.textMuted}]}>{data.count}/{data.total} badge · Streak 100: {data.streak}×</Text><View style={[s.track,{backgroundColor:colors.cardAlt}]}><View style={{height:6,borderRadius:4,width:`${progress*100}%`,backgroundColor:colors.primary}}/></View><Text style={[s.center,{color:colors.textMuted}]}>{info.next===null?'Tahap tertinggi tercapai!':`${Math.max(0,info.next-data.count)} badge lagi untuk evolusi berikutnya`}</Text><View style={[s.reminder,{backgroundColor:colors.cardAlt}]}><Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary}/><Text style={{flex:1,color:colors.text,fontSize:14,lineHeight:20}}>{data.reminder.text}</Text></View></>:<Text style={[s.center,{color:colors.textMuted}]}>{error?'Data belum bisa dimuat.':'Memuat pencapaianmu…'}</Text>}
          <EvolutionGallery stage={stage} count={data?.count} colors={colors}/>
          <Text style={[s.center,{color:colors.textMuted}]}>Geser kucing ke arah mana saja. Saat dilepas, ia menempel ke sisi kiri atau kanan terdekat.</Text><Pressable style={s.action} onPress={()=>{positionRef.current=0;setPosition(0);snapTo(1,false);setOpen(false);}}><Ionicons name="locate-outline" size={18} color={colors.primary}/><Text style={{color:colors.primary,fontWeight:'700'}}>Reset posisi pet</Text></Pressable>
          {error&&data?<Text style={[s.center,{color:colors.textMuted}]}>Data terakhir ditampilkan; sinkronisasi gagal.</Text>:null}
          <View style={s.row}><Pressable accessibilityRole="button" onPress={()=>{setMini(v=>!v);setOpen(false);}} style={s.action}><Ionicons name={mini?'expand-outline':'contract-outline'} size={18} color={colors.primary}/><Text style={{color:colors.primary,fontWeight:'600'}}>{mini?'Perbesar':'Perkecil'}</Text></Pressable><Pressable accessibilityRole="button" onPress={refresh} style={s.action}><Ionicons name="refresh" size={18} color={colors.primary}/><Text style={{color:colors.primary,fontWeight:'600'}}>Muat ulang</Text></Pressable></View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}
const s=StyleSheet.create({overlayHost:{...StyleSheet.absoluteFillObject,zIndex:120,elevation:8},overlay:{position:'absolute',gap:4},petButton:{alignItems:'center',justifyContent:'center'},dot:{position:'absolute',right:4,top:6,width:12,height:12,borderRadius:6,backgroundColor:'#F59E0B',borderWidth:2},bubble:{position:'absolute',maxWidth:210,padding:10,borderRadius:14,borderWidth:1},scrim:{flex:1,backgroundColor:'rgba(0,0,0,.48)',justifyContent:'flex-end',alignItems:'center',paddingHorizontal:16},panel:{width:'100%',maxHeight:'92%',maxWidth:420,borderWidth:1,borderRadius:24,padding:18,gap:10},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},title:{fontSize:18,fontWeight:'800'},hero:{width:128,height:128,alignSelf:'center'},stage:{fontSize:20,fontWeight:'800',textAlign:'center'},center:{fontSize:13,textAlign:'center'},track:{height:6,borderRadius:4,overflow:'hidden'},reminder:{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderRadius:14},action:{flexDirection:'row',gap:6,alignItems:'center',paddingVertical:9,paddingHorizontal:5}});
