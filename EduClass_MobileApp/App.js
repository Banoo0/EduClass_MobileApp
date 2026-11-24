import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { UnreadProvider } from './src/context/UnreadContext';
import RootNavigator from './src/navigation/RootNavigator';
function ThemedApp() {
  const { mode, colors } = useAppTheme();
  const base=mode==='light'?DefaultTheme:DarkTheme;
  const navTheme={...base,colors:{...base.colors,background:colors.bg,card:colors.card,border:colors.border,primary:colors.primary,text:colors.text,notification:colors.danger}};
  return <NavigationContainer theme={navTheme}><StatusBar style={mode==='light'?'dark':'light'}/><RootNavigator/></NavigationContainer>;
}
export default function App() {
  return <SafeAreaProvider><ThemeProvider><AuthProvider><UnreadProvider><ThemedApp/></UnreadProvider></AuthProvider></ThemeProvider></SafeAreaProvider>;
}
