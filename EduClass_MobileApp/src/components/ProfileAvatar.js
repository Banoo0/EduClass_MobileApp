import { useState, useEffect } from 'react';
import { View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
export const avatars=['person','rocket','planet','bulb','star','leaf','school','happy'];
export default function ProfileAvatar({avatar,photo,size=72,color='#9DBDFF'}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[photo]);
 const valid=typeof photo==='string'&&photo.length>0&&photo.length<=60000;
 return <View style={{width:size,height:size,borderRadius:size/2,overflow:'hidden',backgroundColor:color,alignItems:'center',justifyContent:'center'}}>{valid&&!failed?<Image source={{uri:`data:image/jpeg;base64,${photo}`}} style={{width:size,height:size}} resizeMode="cover" onError={()=>setFailed(true)}/>:<Ionicons name={avatars.includes(avatar)?avatar:'person'} size={size*.52} color="#0E1015"/>}</View>;
}
