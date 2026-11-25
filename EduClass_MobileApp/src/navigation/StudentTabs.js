import { PetPanelProvider } from '../components/PetPanelContext';
import StreakPetOverlay from '../components/StreakPetOverlay';
import { useIsFocused } from '@react-navigation/native';
import { ThemeProvider as NavigationThemeProvider, useTheme as useNavigationTheme } from '@react-navigation/native';
import { renderFocusedTabScene } from '../components/FocusedTabScene';
import { useAppTheme } from '../context/ThemeContext';
import FloatingTabBar, { FloatingDockProvider } from '../components/FloatingTabBar';
import PrivateChatScreen from '../screens/shared/PrivateChatScreen';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BerandaScreen from '../screens/student/BerandaScreen';
import KelasScreen from '../screens/student/KelasScreen';
import GabungKelasScreen from '../screens/student/GabungKelasScreen';
import JadwalScreen from '../screens/student/JadwalScreen';
import StudentMeetingListScreen from '../screens/student/StudentMeetingListScreen';
import ProfilScreen from '../screens/student/ProfilScreen';
import TugasScreen from '../screens/student/TugasScreen';
import DetailTugasScreen from '../screens/student/DetailTugasScreen';
import UploadFileScreen from '../screens/student/UploadFileScreen';

import { colors } from '../core/theme';

const Tab = createBottomTabNavigator();
const KelasStack = createNativeStackNavigator();
const TugasStack = createNativeStackNavigator();

function TugasNavigator() {
  const { colors, mode: appThemeMode } = useAppTheme();

  return <TugasStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
    <TugasStack.Screen name="DaftarTugas" component={TugasScreen} />
    <TugasStack.Screen name="DetailTugas" component={DetailTugasScreen} />
    <TugasStack.Screen name="UploadTugas" component={UploadFileScreen} />
  </TugasStack.Navigator>;
}

// Stack di dalam tab Kelas.
// Siswa bisa membuka halaman gabung, lalu kembali ke daftar kelas.
function KelasNavigator() {
  const { colors, mode: appThemeMode } = useAppTheme();

  return (
    <KelasStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <KelasStack.Screen
        name="KelasUtama"
        component={KelasScreen}
      />

      <KelasStack.Screen
        name="GabungKelas"
        component={GabungKelasScreen}
      />
      <KelasStack.Screen
        name="DaftarPertemuan"
        component={StudentMeetingListScreen}
      />
      <KelasStack.Screen name="ChatPribadi" component={PrivateChatScreen} />
    </KelasStack.Navigator>
  );
}

const ICONS = {
  Beranda: ['home', 'home-outline'],
  Tugas: ['document-text', 'document-text-outline'],
  Jadwal: ['calendar', 'calendar-outline'],
  Kelas: ['school', 'school-outline'],
  Profil: ['person', 'person-outline'],
};

export default function StudentTabs() {
  const { colors, mode: appThemeMode } = useAppTheme();

  const focused = useIsFocused();
  const navigationTheme = useNavigationTheme();
  const transparentTheme = { ...navigationTheme, colors: { ...navigationTheme.colors, background: 'transparent' } };

  return (
    <PetPanelProvider><FloatingDockProvider>
    <NavigationThemeProvider value={transparentTheme}>
    <Tab.Navigator
      screenLayout={renderFocusedTabScene}
      detachInactiveScreens={true}
      tabBar={(props) => <FloatingTabBar {...props} icons={ICONS} />}
      screenOptions={{ headerShown: false, freezeOnBlur: false, animation: 'none', sceneStyle: { backgroundColor: 'transparent' }, tabBarStyle: { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0 } }}
    >
      <Tab.Screen
        name="Beranda"
        component={BerandaScreen}
      />

      <Tab.Screen
        name="Tugas"
        component={TugasNavigator}
      />

      <Tab.Screen
        name="Jadwal"
        component={JadwalScreen}
      />

      <Tab.Screen
        name="Kelas"
        component={KelasNavigator}
      />

      <Tab.Screen
        name="Profil"
        component={ProfilScreen}
      />
    </Tab.Navigator>
    </NavigationThemeProvider>
    <StreakPetOverlay focused={focused} />
    </FloatingDockProvider></PetPanelProvider>
  );
}
