import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../core/supabase';
import { fetchProfile, signInWithEmail, signOutUser, signUpWithEmail } from '../services/authServices';

const AuthContext = createContext(null);

function profileToState(id, { data, error }) {
  return {
    id,
    data: data ?? null,
    error: error ? error.message : data ? null : 'Profil belum ada di database.',
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileState, setProfileState] = useState({ id: null, data: null, error: null });

  // 1. Baca sesi tersimpan, lalu pantau perubahan login/logout
  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setSessionReady(true);
      })
      .catch(() => active && setSessionReady(true));

    // Jangan memanggil Supabase lain di dalam callback ini, cukup simpan sesinya
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setSessionReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 2. Perpanjang token otomatis hanya saat aplikasi aktif
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => listener.remove();
  }, []);

  // 3. Ambil profil (berisi role) setiap kali pengguna berganti
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      setProfileState({ id: null, data: null, error: null });
      return undefined;
    }
    let cancelled = false;
    fetchProfile(userId).then((res) => {
      if (!cancelled) setProfileState(profileToState(userId, res));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    setProfileState(profileToState(userId, await fetchProfile(userId)));
  }, [userId]);

  const loading = !sessionReady || (userId !== null && profileState.id !== userId);
  const profile = profileState.id === userId ? profileState.data : null;

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      profileError: profileState.error,
      loading,
      signIn: signInWithEmail,
      signUp: signUpWithEmail,
      signOut: signOutUser,
      refreshProfile,
    }),
    [session, profile, profileState.error, loading, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}