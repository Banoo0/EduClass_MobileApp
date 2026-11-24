import { ThemeProvider as NavigationThemeProvider, useTheme as useNavigationTheme } from '@react-navigation/native';
import { renderFocusedTabScene } from '../components/FocusedTabScene';
import { useAppTheme } from '../context/ThemeContext';
import FloatingTabBar, { FloatingDockProvider } from '../components/FloatingTabBar';
import PrivateChatScreen from '../screens/shared/PrivateChatScreen';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BerandaScreen from '../screens/teacher/BerandaScreen';
import KelolaKelasScreen from '../screens/teacher/KelolaKelasScreen';
import MeetingManagementScreen from '../screens/teacher/MeetingManagementScreen';
import JadwalScreen from '../screens/teacher/JadwalScreen';
import ProfilScreen from '../screens/teacher/ProfilScreen';
import KelolaTugasScreen from '../screens/teacher/KelolaTugasScreen';
import ReviewSubmissionsScreen from '../screens/teacher/ReviewSubmissionsScreen';

import { colors } from '../core/theme';

const Tab = createBottomTabNavigator();
const ClassStack = createNativeStackNavigator();
const TaskStack = createNativeStackNavigator();

function ClassManagementNavigator() {
  const { colors, mode: appThemeMode } = useAppTheme();

  return (
    <ClassStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <ClassStack.Screen name="DaftarKelas" component={KelolaKelasScreen} />
      <ClassStack.Screen name="KelolaPertemuan" component={MeetingManagementScreen} />
      <ClassStack.Screen name="ChatPribadi" component={PrivateChatScreen} />
    </ClassStack.Navigator>
  );
}

function TaskManagementNavigator() {
  const { colors, mode: appThemeMode } = useAppTheme();

  return <TaskStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
    <TaskStack.Screen name="DaftarTugasGuru" component={KelolaTugasScreen} />
    <TaskStack.Screen name="PeriksaTugas" component={ReviewSubmissionsScreen} />
  </TaskStack.Navigator>;
}

const ICONS = {
  Beranda: ['home', 'home-outline'],
  KelolaKelas: ['people', 'people-outline'],
  Jadwal: ['calendar', 'calendar-outline'],
  Profil: ['person', 'person-outline'],
};

export default function TeacherTabs() {
  const { colors, mode: appThemeMode } = useAppTheme();

  const navigationTheme = useNavigationTheme();
  const transparentTheme = { ...navigationTheme, colors: { ...navigationTheme.colors, background: 'transparent' } };

  return (
    <FloatingDockProvider>
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
        name="KelolaKelas"
        component={ClassManagementNavigator}
        options={{ title: 'Kelola Kelas' }}
      />

      <Tab.Screen
        name="BuatTugas"
        component={TaskManagementNavigator}
        options={{ title: 'Buat Tugas' }}
      />

      <Tab.Screen
        name="Jadwal"
        component={JadwalScreen}
      />

      <Tab.Screen
        name="Profil"
        component={ProfilScreen}
      />
    </Tab.Navigator>
    </NavigationThemeProvider>
    </FloatingDockProvider>
  );
}
