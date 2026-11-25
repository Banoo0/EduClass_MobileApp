import {useEffect,useState} from 'react';
import {Image,View,StyleSheet} from 'react-native';
const frames=[
  [require('./streakpet/rookie_0.png'),require('./streakpet/rookie_1.png'),require('./streakpet/rookie_2.png'),require('./streakpet/rookie_3.png')],
  [require('./streakpet/adventurer_0.png'),require('./streakpet/adventurer_1.png'),require('./streakpet/adventurer_2.png'),require('./streakpet/adventurer_3.png')],
  [require('./streakpet/knight_0.png'),require('./streakpet/knight_1.png'),require('./streakpet/knight_2.png'),require('./streakpet/knight_3.png')],
  [require('./streakpet/guardian_0.png'),require('./streakpet/guardian_1.png'),require('./streakpet/guardian_2.png'),require('./streakpet/guardian_3.png')],
];
const idle=[[1,850],[3,650],[2,140],[3,850],[1,700]];
const happy=[[0,400],[2,240],[0,420],[1,300]];
export default function WarriorSprite({stage=0,size=90,active=true,reduce=false,reaction=0}) {
 const [frame,setFrame]=useState(1);
 useEffect(()=>{
  let timer, cancelled=false, step=0;
  if(!active||reduce){setFrame(1);return;}
  const tick=(seq,repeat)=>{if(cancelled)return; if(step>=seq.length){step=0;if(!repeat){tick(idle,true);return;}} const [f,ms]=seq[step++];setFrame(f);timer=setTimeout(()=>tick(seq,repeat),ms);};
  tick(reaction?happy:idle,!reaction);
  return()=>{cancelled=true;clearTimeout(timer);};
 },[stage,active,reduce,reaction]);
 return <View pointerEvents="none" style={{width:size,height:size}}>{frames[Math.max(0,Math.min(3,stage))].map((source,i)=><Image key={i} source={source} resizeMode="contain" style={[StyleSheet.absoluteFill,{width:size,height:size,opacity:i===frame?1:0}]}/>)}</View>;
}
