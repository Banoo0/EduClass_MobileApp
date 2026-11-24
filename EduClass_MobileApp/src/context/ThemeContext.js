import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as darkColors, lightColors } from '../core/theme';
const ThemeContext = createContext(null);
const STORAGE_KEY = 'educlass.theme.v1';
export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('dark');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(STORAGE_KEY).then(value => { if (live && (value === 'light' || value === 'dark')) setMode(value); }).catch(() => {}).finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);
  const changeTheme = useCallback(value => {
    if (value !== 'dark' && value !== 'light') return;
    setMode(value);
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {});
  }, []);
  if (!ready) return null;
  return <ThemeContext.Provider value={{ mode, colors: mode === 'light' ? lightColors : darkColors, changeTheme }}>{children}</ThemeContext.Provider>;
}
export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider belum tersedia.');
  return value;
}
