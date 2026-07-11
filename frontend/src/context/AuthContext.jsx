// AuthContext.jsx — app-wide auth state, persisted across refresh by the httpOnly
// session cookie. On mount it probes GET /auth/me to rehydrate the current user.
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import apiClient from '../api/client';

const AuthContext = createContext(null);
const AUTH_CHANNEL = 'rally-auth';
const AUTH_STORAGE_KEY = 'rally-auth-event';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // initial session probe
  const [authError, setAuthError] = useState(null); // transport failure during the probe

  const publishAuthEvent = useCallback((type) => {
    const payload = { type, at: Date.now() };
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* localStorage can be unavailable in private browsing modes */
    }
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(AUTH_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    }
  }, []);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setAuthError(null);
    try {
      const res = await apiClient.get('/auth/me');
      // Keep the previous object when nothing changed so identity-keyed effects
      // (e.g. the Settings form sync) don't refire on silent focus refreshes and
      // wipe in-progress edits. Key order is stable (same serializer both times).
      setUser((prev) => {
        const next = res.data.user ?? null;
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
    } catch (err) {
      setUser(null);
      // A 401/normal response means "logged out" (not an error). A missing response
      // (network down) or 5xx is a real failure we must surface — no silent failures.
      if (!err.response || err.response.status >= 500) {
        setAuthError('Could not reach the server. Check your connection and try again.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Rehydrate on first load (this is what persists auth across refreshes).
  useEffect(() => {
    refresh();
  }, [refresh]);

  // If any request 401s (e.g. session expired), drop the user.
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      publishAuthEvent('logout');
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [publishAuthEvent]);

  // Keep multiple open tabs in sync when one tab logs in, logs out, or expires.
  useEffect(() => {
    const applyAuthEvent = (payload) => {
      if (!payload?.type) return;
      if (payload.type === 'logout') {
        setUser(null);
        return;
      }
      refresh({ silent: true });
    };

    let channel = null;
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(AUTH_CHANNEL);
      channel.onmessage = (event) => applyAuthEvent(event.data);
    }

    const onStorage = (event) => {
      if (event.key !== AUTH_STORAGE_KEY || !event.newValue) return;
      try {
        applyAuthEvent(JSON.parse(event.newValue));
      } catch {
        /* ignore malformed storage payloads */
      }
    };

    const onFocus = () => refresh({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh({ silent: true });
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      channel?.close();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const res = await apiClient.post('/auth/login', { username, password });
    setUser(res.data.user);
    publishAuthEvent('login');
    return res.data.user;
  }, [publishAuthEvent]);

  const register = useCallback(async (payload) => {
    const res = await apiClient.post('/auth/register', payload);
    setUser(res.data.user);
    publishAuthEvent('login');
    return res.data.user;
  }, [publishAuthEvent]);

  const logout = useCallback(async () => {
    // Clear local auth even if the request fails, so the user is never stuck "logged in".
    try {
      await apiClient.post('/auth/logout');
    } catch {
      /* the local logout still wins if the server session was already gone */
    } finally {
      setUser(null);
      publishAuthEvent('logout');
    }
  }, [publishAuthEvent]);

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
