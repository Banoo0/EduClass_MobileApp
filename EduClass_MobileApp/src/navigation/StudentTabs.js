import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import PlaceholderScreen from '../components/PlaceholderScreen';
import ProfilScreen from '../screens/student/ProfilScreen';
import { colors } from '../core/theme';

const Tab = createBottomTabNavigator();

// Ganti komponen sementara ini dengan layar aslimu, contoh:
//   import BerandaScreen from '../screens/student/BerandaScreen';
//   <Tab.Screen name="Beranda" component={BerandaScreen} />
const Beranda = () => <PlaceholderScreen title="Beranda" owner="Afni" />;
const Tugas = () => <PlaceholderScreen title="Tugas" />;
const Jadwal = () => <PlaceholderScreen title="Jadwal" owner="Rizki" />;
const Kelas = () => <PlaceholderScreen title="Kelas" owner="Rizki" />;

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
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Beranda" component={Beranda} />
      <Tab.Screen name="Tugas" component={Tugas} />
      <Tab.Screen name="Jadwal" component={Jadwal} />
      <Tab.Screen name="Kelas" component={Kelas} />
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  );
}