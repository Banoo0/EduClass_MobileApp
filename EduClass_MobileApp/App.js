import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { supabase } from './src/core/supabase';

export default function App() {
  const [status, setStatus] = useState('Mengecek koneksi...');

  useEffect(() => {
    async function tes() {
      const { data, error } = await supabase.from('schools').select('nama_sekolah');
      if (error) {
        setStatus('Gagal: ' + error.message);
      } else {
        setStatus('Terhubung! Jumlah sekolah: ' + data.length);
      }
    }
    tes();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1d26',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: { color: '#ffee4a', fontSize: 18, textAlign: 'center' },
});