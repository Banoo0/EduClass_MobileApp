import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import PlaceholderScreen from '../components/PlaceholderScreen';
import BerandaScreen from '../screens/teacher/BerandaScreen';
import ProfilScreen from '../screens/teacher/ProfilScreen';
import { colors } from '../core/theme';

const Tab = createBottomTabNavigator();

// Ganti komponen sementara ini dengan layar aslimu, contoh:
//   import KelolaKelasScreen from '../screens/teacher/KelolaKelasScreen';
//   <Tab.Screen name="KelolaKelas" component={KelolaKelasScreen} options={{ title: 'Kelola Kelas' }} />
const KelolaKelas = () => <PlaceholderScreen title="Kelola kelas" owner="Rizki" />;
const BuatTugas = () => <PlaceholderScreen title="Buat tugas" />;
const Jadwal = () => <PlaceholderScreen title="Jadwal mengajar" owner="Rizki" />;

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
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => {
          // Tombol tengah "Buat Tugas" berbentuk lingkaran biru seperti di mockup
          if (route.name === 'BuatTugas') {
            return (
              <View style={styles.fab}>
                <Ionicons name="add" size={26} color="#FFFFFF" />
              </View>
            );
          }
          return <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Beranda" component={BerandaScreen} />
      <Tab.Screen name="KelolaKelas" component={KelolaKelas} options={{ title: 'Kelola Kelas' }} />
      <Tab.Screen name="BuatTugas" component={BuatTugas} options={{ title: 'Buat Tugas' }} />
      <Tab.Screen name="Jadwal" component={Jadwal} />
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});