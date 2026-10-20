import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>EduClass</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1d26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: '#ffee4a', fontSize: 28, fontWeight: 'bold' },
});