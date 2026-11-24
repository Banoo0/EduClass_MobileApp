import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../context/ThemeContext';

// Decorative only: no interaction, no text, no large bitmap assets.
export default function AppBackdrop() {
  const { mode } = useAppTheme();
  const light = mode === 'light';
  const line = light ? 'rgba(37,99,180,0.085)' : 'rgba(119,163,245,0.075)';
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.layer}>
    <LinearGradient colors={light ? ['#DDEBFA','#F7F9FD','#E9E8F7'] : ['#1B2A45','#101724','#19172B']} locations={[0,.52,1]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.fill}/>
    {[0,1,2].map(i=><View key={i} style={{position:'absolute',width:250+i*52,height:250+i*52,borderRadius:150+i*26,borderWidth:1,borderColor:line,right:-110-i*24,top:-90-i*24}}/>)}
    {[0,1].map(i=><View key={i} style={{position:'absolute',width:230+i*54,height:230+i*54,borderRadius:150+i*27,borderWidth:1,borderColor:line,left:-130-i*24,bottom:-85-i*24}}/>)}
  </View>;
}
const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 };
const s = StyleSheet.create({ layer: { ...fill, overflow: 'hidden' }, fill });
