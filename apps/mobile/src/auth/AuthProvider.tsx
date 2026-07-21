import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { setUnauthorizedHandler } from '../api/client';
import { AuthUser, useUserStore } from '../store/userStore';
import { tokenStorage } from './tokenStorage';

type AuthStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  /** Mock login until NestJS auth is wired. Stores a placeholder JWT in SecureStore. */
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: React.ReactNode;
};

function buildMockUser(email: string): AuthUser {
  const local = email.split('@')[0] || 'user';
  return {
    id: 'mock-user-1',
    email: email.trim().toLowerCase(),
    firstName: local.charAt(0).toUpperCase() + local.slice(1),
    lastName: 'Academy',
    role: 'student',
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('bootstrapping');
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const clearUser = useUserStore((s) => s.clearUser);

  const signOut = useCallback(async () => {
    await tokenStorage.clear();
    clearUser();
    setStatus('unauthenticated');
  }, [clearUser]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearUser();
      setStatus('unauthenticated');
    });
    return () => setUnauthorizedHandler(null);
  }, [clearUser]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const token = await tokenStorage.getAccessToken();
        if (cancelled) return;

        if (!token) {
          clearUser();
          setStatus('unauthenticated');
          return;
        }

        // Placeholder session until /auth/me (or equivalent) is connected.
        if (!useUserStore.getState().user) {
          setUser({
            id: 'mock-user-1',
            email: 'session@longhua.local',
            firstName: 'Longhua',
            lastName: 'User',
            role: 'student',
          });
        }
        setStatus('authenticated');
      } catch {
        if (!cancelled) {
          await tokenStorage.clear();
          clearUser();
          setStatus('unauthenticated');
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [clearUser, setUser]);

  const signIn = useCallback(
    async (email: string, _password: string) => {
      // Mock JWT placeholder — replace with NestJS login response.
      const mockAccessToken = `mock-jwt.${encodeURIComponent(email.trim().toLowerCase())}.${Date.now()}`;

      await tokenStorage.setAccessToken(mockAccessToken);
      setUser(buildMockUser(email));
      setStatus('authenticated');
    },
    [setUser],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, signOut }),
    [status, user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
