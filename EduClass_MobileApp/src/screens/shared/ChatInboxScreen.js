import UnreadBadge from '../../components/UnreadBadge';
import { useUnread } from '../../context/UnreadContext';
import { FloatingSafeAreaView } from '../../components/FloatingTabBar';
import { useAppTheme } from '../../context/ThemeContext';
import AppBackdrop from '../../components/AppBackdrop';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../core/theme';
export default function ChatInboxScreen({navigation}){
  const { colors, mode: appThemeMode } = useAppTheme();
  const s = make_s(colors);

  const {user,role}=useAuth(); const focused=useIsFocused();
  const {rows,loading,error}=useUnread();
  const sorted=[...rows].sort((a,b)=>(b.latest?.created_at?.toMillis?.()||0)-(a.latest?.created_at?.toMillis?.()||0));
  return <FloatingSafeAreaView style={s.safe}><AppBackdrop /><View style={s.header}><Pressable onPress={()=>navigation.goBack()}><Ionicons name="arrow-back" size={24} color={colors.primary}/></Pressable><Text style={s.title}>Chat Pribadi</Text></View>{error?<Text style={s.error}>{error}</Text>:null}{loading?<ActivityIndicator color={colors.primary}/>:<FlatList data={sorted} keyExtractor={x=>x.id} contentContainerStyle={{padding:16,gap:10}} ListEmptyComponent={<Text style={s.muted}>Belum ada kontak kelas.</Text>} renderItem={({item})=><Pressable style={s.card} onPress={()=>navigation.navigate('ChatLangsung',{classId:item.classId,studentId:item.studentId})}><Ionicons name="person-circle-outline" size={38} color={colors.primary}/><View style={{flex:1,minWidth:0}}><Text style={s.name}>{item.name}</Text><Text style={s.muted}>{item.label}</Text><Text numberOfLines={1} style={s.muted}>{item.latest?(item.latest.sender_id===user.uid?'Kamu: ':'')+item.latest.isi:'Belum ada pesan'}</Text></View><UnreadBadge count={item.unread}/><Ionicons name="chevron-forward" size={20} color={colors.textMuted}/></Pressable>}/>}</FloatingSafeAreaView>;
}
const make_s = (colors) => (StyleSheet.create({safe:{flex:1,backgroundColor:colors.bg},header:{padding:16,flexDirection:'row',alignItems:'center',gap:14},title:{fontSize:22,fontWeight:'800',color:colors.text},card:{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:14,backgroundColor:colors.card},name:{fontSize:16,fontWeight:'700',color:colors.text},muted:{fontSize:13,color:colors.textMuted},error:{color:colors.danger,padding:16}}));
