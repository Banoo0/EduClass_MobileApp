
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import PlaceholderScreen from '../components/PlaceholderScreen';
import BerandaScreen from '../screens/teacher/BerandaScreen';
import KelolaKelasScreen from '../screens/teacher/KelolaKelasScreen';
import MeetingManagementScreen from '../screens/teacher/MeetingManagementScreen';
import JadwalScreen from '../screens/teacher/JadwalScreen';
import ProfilScreen from '../screens/teacher/ProfilScreen';

import { colors } from '../core/theme';

const Tab = createBottomTabNavigator();
const ClassStack = createNativeStackNavigator();

function ClassManagementNavigator() {
  return (
    <ClassStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <ClassStack.Screen name="DaftarKelas" component={KelolaKelasScreen} />
      <ClassStack.Screen name="KelolaPertemuan" component={MeetingManagementScreen} />
    </ClassStack.Navigator>
  );
}

const BuatTugas = () => (
  <PlaceholderScreen title="Buat tugas" />
);

const ICONS = {
  Beranda: ['home', 'home-outline'],
  KelolaKelas: ['people', 'people-outline'],
  Jadwal: ['calendar', 'calendar-outline'],
  Profil: ['person', 'person-outline'],
};

export default function TeacherTabs() {
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
        tabBarIcon: ({ color, size, focused }) => {
          if (route.name === 'BuatTugas') {
            return (
              <View style={styles.fab}>
                <Ionicons name="add" size={26} color="#FFFFFF" />
              </View>
            );
          }

          const icon = ICONS[route.name];

          return (
            <Ionicons
              name={icon[focused ? 0 : 1]}
              size={size}
              color={color}
            />
          );
        },
      })}
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
        component={BuatTugas}
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
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
