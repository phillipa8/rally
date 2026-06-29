// AuthContext.jsx — app-wide auth state, persisted across refresh by the httpOnly
// session cookie. On mount it probes GET /auth/me to rehydrate the current user.
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // initial session probe
  const [authError, setAuthError] = useState(null); // transport failure during the probe

  const refresh = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await apiClient.get('/auth/me');
      setUser(res.data.user ?? null);
    } catch (err) {
      setUser(null);
      // A 401/normal response means "logged out" (not an error). A missing response
      // (network down) or 5xx is a real failure we must surface — no silent failures.
      if (!err.response || err.response.status >= 500) {
        setAuthError('Could not reach the server. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Rehydrate on first load (this is what persists auth across refreshes).
  useEffect(() => {
    refresh();
  }, [refresh]);

  // If any request 401s (e.g. session expired), drop the user.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await apiClient.post('/auth/login', { username, password });
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await apiClient.post('/auth/register', payload);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    // Clear local auth even if the request fails, so the user is never stuck "logged in".
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      authError,
      login,
      register,
      logout,
      refresh,
    }),
    [user, loading, authError, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
