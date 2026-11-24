import UnreadBadge from './UnreadBadge';
import { useUnread } from '../context/UnreadContext';
import { Children, createContext, useContext } from 'react';
import AppBackdrop from './AppBackdrop';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../core/theme';

// Overlay dock and content inset use the same geometry.
const BAR_HEIGHT = 64;
const bottomGap = (insets) => Math.max(10, insets.bottom);
const DockInsetContext = createContext(0);

export function FloatingDockProvider({ children }) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  return (
    <DockInsetContext.Provider value={BAR_HEIGHT + bottomGap(insets) + 8}>
      <View style={{ flex: 1, minHeight: 0, position: 'relative', backgroundColor: colors.bg }}>
        <AppBackdrop />
        {children}
      </View>
    </DockInsetContext.Provider>
  );
}

// Reserve space inside the page, not outside its full-height backdrop.
export function FloatingSafeAreaView({ style, children, ...props }) {
  const inset = useContext(DockInsetContext);
  // Inside tabs, the single full-height backdrop belongs to the dock provider.
  // Outside tabs (e.g. root chat), retain the screen's own backdrop.
  const content = inset > 0
    ? Children.toArray(children).filter(child => child?.type !== AppBackdrop)
    : children;
  return (
    <SafeAreaView {...props} style={[style, inset > 0 ? { flex: 1, minHeight: 0, backgroundColor: 'transparent', paddingBottom: inset } : null]}>
      {content}
    </SafeAreaView>
  );
}
export default function FloatingTabBar({ state, descriptors, navigation, icons }) {
  const { colors, mode: appThemeMode } = useAppTheme();
  const s = make_s(colors);
  const {chatCount}=useUnread();

  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[s.dock, { bottom: bottomGap(insets), paddingLeft: Math.max(12, insets.left), paddingRight: Math.max(12, insets.right) }]}>
      <View style={s.bar}>
        {state.routes.map((route, index) => {
          const active = state.index === index;
          const options = descriptors[route.key].options;
          const label = options.title ?? route.name;
          const create = route.name === 'BuatTugas';
          const icon = create ? 'add' : icons[route.name]?.[active ? 0 : 1] ?? 'ellipse-outline';
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!active && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable key={route.key} accessibilityRole="button" accessibilityLabel={options.tabBarAccessibilityLabel ?? label} accessibilityState={{ selected: active }} onPress={onPress} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })} style={[s.tab, active && s.active]}>
              <View style={[s.icon, create && s.create]}>
                <Ionicons name={icon} size={create ? 25 : 23} color={create ? '#fff' : active ? colors.navActiveText : colors.textMuted} />{route.name==='Profil'?<UnreadBadge count={chatCount} floating/>:null}
              </View>
              <Text numberOfLines={1} style={[s.label, active && s.activeLabel]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
const make_s = (colors) => (StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, backgroundColor: 'transparent', alignItems: 'center', zIndex: 100 },
  bar: { height: BAR_HEIGHT, width: '100%', maxWidth: 560, flexDirection: 'row', alignItems: 'center', padding: 5, gap: 2, borderRadius: 36, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.navSurface, ...Platform.select({ web: { boxShadow: '0 5px 18px rgba(0,0,0,0.35)' }, default: { elevation: 5, shadowColor: '#000', shadowOpacity: .3, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } } }) },
  tab: { flex: 1, minWidth: 0, minHeight: 52, borderRadius: 28, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 1 },
  active: { backgroundColor: colors.navActive },
  icon: { height: 30, width: 32, alignItems: 'center', justifyContent: 'center' },
  create: { backgroundColor: colors.primary, borderRadius: 16 },
  label: { color: colors.textMuted, fontSize: 10, fontWeight: '600', maxWidth: '100%' },
  activeLabel: { color: colors.navActiveText },
}));
