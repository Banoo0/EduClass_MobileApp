import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../core/firebase';
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
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileState, setProfileState] = useState({ id: null, data: null, error: null });

  // 1. Pantau status login (sesi tersimpan otomatis dipulihkan oleh Firebase)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // 2. Ambil profil (berisi role) setiap kali pengguna berganti
  const userId = user?.uid ?? null;
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

  const loading = !authReady || (userId !== null && profileState.id !== userId);
  const profile = profileState.id === userId ? profileState.data : null;

  const value = useMemo(
    () => ({
      session: user, // nama lama dipertahankan supaya RootNavigator tidak perlu diubah
      user,
      profile,
      role: profile?.role ?? null,
      profileError: profileState.error,
      loading,
      signIn: signInWithEmail,
      signUp: signUpWithEmail,
      signOut: signOutUser,
      refreshProfile,
    }),
    [user, profile, profileState.error, loading, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}