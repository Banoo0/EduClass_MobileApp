import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
export default function ThemeSettings() {
  const { mode, colors, changeTheme } = useAppTheme();
  return <View style={{backgroundColor:colors.card,borderColor:colors.border,borderWidth:1,borderRadius:18,padding:14,gap:12}}>
    <Text style={{color:colors.text,fontSize:17,fontWeight:'700'}}>Tampilan</Text>
    <View style={{flexDirection:'row',gap:8}}>
      {[['light','sunny-outline','Terang'],['dark','moon-outline','Gelap']].map(([value,icon,label])=>{
        const active=mode===value;
        return <Pressable key={value} accessibilityRole="button" accessibilityState={{selected:active}} onPress={()=>changeTheme(value)} style={{flex:1,minHeight:46,borderRadius:12,borderWidth:1,borderColor:active?colors.primary:colors.border,backgroundColor:active?colors.primarySoft:colors.cardAlt,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7}}><Ionicons name={icon} size={19} color={active?colors.primary:colors.textMuted}/><Text style={{color:active?colors.primary:colors.text,fontSize:14,fontWeight:'600'}}>{label}</Text>{active?<Ionicons name="checkmark" size={15} color={colors.primary}/>:null}</Pressable>;
      })}
    </View>
  </View>;
}
