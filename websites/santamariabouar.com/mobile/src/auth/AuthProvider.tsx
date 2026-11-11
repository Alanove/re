import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Device from 'expo-device';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/endpoints';
import { clearTokens, refreshSession, setSessionExpiredHandler, storeTokens } from '@/api/client';
import type { Profile, TokenResponse } from '@/api/types';
import { tokenStorage } from './tokenStorage';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
export type AppMode = 'member' | 'admin';

interface AuthContextValue {
  status: AuthStatus;
  user: Profile | null;
  mode: AppMode;
  sessionExpired: boolean;
  signIn: (login: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setMode: (mode: AppMode) => void;
  refreshProfile: () => Promise<void>;
  applyTokens: (tokens: TokenResponse) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function deviceName(): string {
  return [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || 'Mobile app';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<Profile | null>(null);
  const [mode, setMode] = useState<AppMode>('member');
  const [sessionExpired, setSessionExpired] = useState(false);

  const resetSession = useCallback(
    async (expired: boolean) => {
      await clearTokens();
      queryClient.clear();
      setUser(null);
      setMode('member');
      setSessionExpired(expired);
      setStatus('signedOut');
    },
    [queryClient]
  );

  useEffect(() => {
    setSessionExpiredHandler(() => {
      void resetSession(true);
    });
    return () => setSessionExpiredHandler(null);
  }, [resetSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const restored = await refreshSession();
        if (!restored) {
          if (!cancelled) setStatus('signedOut');
          return;
        }
        const profile = await authApi.me();
        if (cancelled) return;
        setUser(profile);
        setMode(profile.isAdmin ? 'admin' : 'member');
        setStatus('signedIn');
      } catch {
        // Offline at launch: keep the stored token and let the user retry from the login screen.
        if (!cancelled) setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (login: string, password: string) => {
    const result = await authApi.login(login, password, deviceName());
    await storeTokens(result);
    setSessionExpired(false);
    setUser(result.user);
    setMode(result.user.isAdmin ? 'admin' : 'member');
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Token is cleared locally either way; the server copy expires on its own.
      }
    }
    await resetSession(false);
  }, [resetSession]);

  const refreshProfile = useCallback(async () => {
    const profile = await authApi.me();
    setUser(profile);
    if (!profile.isAdmin) setMode('member');
  }, []);

  const applyTokens = useCallback(async (tokens: TokenResponse) => {
    await storeTokens(tokens);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, mode, sessionExpired, signIn, signOut, setMode, refreshProfile, applyTokens }),
    [status, user, mode, sessionExpired, signIn, signOut, refreshProfile, applyTokens]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
