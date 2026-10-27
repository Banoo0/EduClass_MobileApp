
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import PlaceholderScreen from '../components/PlaceholderScreen';
import BerandaScreen from '../screens/student/BerandaScreen';
import KelasScreen from '../screens/student/KelasScreen';
import GabungKelasScreen from '../screens/student/GabungKelasScreen';
import JadwalScreen from '../screens/student/JadwalScreen';
import ProfilScreen from '../screens/student/ProfilScreen';

import { colors } from '../core/theme';

const Tab = createBottomTabNavigator();
const KelasStack = createNativeStackNavigator();

const Tugas = () => <PlaceholderScreen title="Tugas" />;

// Stack di dalam tab Kelas.
// Siswa bisa membuka halaman gabung, lalu kembali ke daftar kelas.
function KelasNavigator() {
  return (
    <KelasStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={ICONS[route.name][focused ? 0 : 1]}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen
        name="Beranda"
        component={BerandaScreen}
      />

      <Tab.Screen
        name="Tugas"
        component={Tugas}
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
  );
}
