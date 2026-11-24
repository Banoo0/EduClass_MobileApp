import { Text, View } from 'react-native';
export default function UnreadBadge({count, floating=false}) {
 if(!count)return null;
 return <View style={[{minWidth:19,height:19,borderRadius:10,paddingHorizontal:4,backgroundColor:'#DC2626',alignItems:'center',justifyContent:'center'},floating&&{position:'absolute',top:-4,right:-6,zIndex:5}]}><Text style={{color:'#fff',fontSize:10,fontWeight:'800'}}>{count>99?'99+':count}</Text></View>;
}
