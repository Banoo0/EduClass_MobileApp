import { View, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

// Keep visited routes mounted, but never paint a blurred route behind the
// transparent active scene. The backdrop lives outside the tab navigator.
function FocusedTabScene({ children }) {
  const focused = useIsFocused();
  return (
    <View
      style={[styles.scene, !focused && styles.hidden]}
      pointerEvents={focused ? 'box-none' : 'none'}
      accessibilityElementsHidden={!focused}
      importantForAccessibility={focused ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </View>
  );
}

export function renderFocusedTabScene({ children }) {
  return <FocusedTabScene>{children}</FocusedTabScene>;
}

const styles = StyleSheet.create({
  scene: { flex: 1, minHeight: 0, backgroundColor: 'transparent' },
  hidden: { display: 'none' },
});
