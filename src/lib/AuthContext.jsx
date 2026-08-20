import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { api, getToken, setToken, onTokenChange } from '@/api';
import {
  clearInFlightEstablish,
  clearSessionCache,
  getCachedSessionUser,
  getInFlightEstablish,
  isActiveSessionWithInvalidRole,
  normalizeSessionUser,
  setCachedSessionUser,
  setInFlightEstablish,
} from './session-user';
import { clearAllOfflineData, ensureOfflineUserScope } from '@/lib/offline/offlineRepository';
import { syncPushSubscriptionIfGranted } from '@/lib/pwa/pushClient';
import { withTimeout } from '@/lib/asyncBounded';
import { disconnectChatSocket } from '@/lib/chat-socket';

const AuthContext = createContext();

/** Optional logout I/O must never block auth clear / login redirect. */
const LOGOUT_OPTIONAL_TIMEOUT_MS = 2500;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({ id: 'longhua-crm', public_settings: { auth_required: true } });
  const [needsNameSetup, setNeedsNameSetup] = useState(false);
  const establishSessionRef = useRef(null);
  const loggingOutRef = useRef(false);

  const applyUserSession = useCallback((currentUser) => {
    if (currentUser.onboarding_state === 'blocked') {
      clearSessionCache();
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setNeedsNameSetup(false);
      setAuthError({
        type: 'blocked',
        message: 'Аккаунт заблокирован. Обратитесь к администратору.',
      });
      void clearAllOfflineData();
      return;
    }

    if (isActiveSessionWithInvalidRole(currentUser)) {
      clearSessionCache();
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setNeedsNameSetup(false);
      setAuthError({
        type: 'auth_required',
        message: 'Сессия недействительна. Войдите снова.',
      });
      void clearAllOfflineData();
      return;
    }

    if (!currentUser.first_name || !currentUser.last_name) {
      setUser(currentUser);
      setIsAuthenticated(true);
      setNeedsNameSetup(true);
      setAuthError(null);
      void ensureOfflineUserScope(currentUser.id, currentUser.role);
      return;
    }

    setUser(currentUser);
    setIsAuthenticated(true);
    setNeedsNameSetup(false);
    setAuthError(null);
    void ensureOfflineUserScope(currentUser.id, currentUser.role);
    void syncPushSubscriptionIfGranted();
  }, []);

  /**
   * Single auth initialization path — idempotent, deduped across StrictMode remounts.
   * @param {{ force?: boolean }} options — force=true bypasses module cache (e.g. after profile update)
   */
  const establishSession = useCallback(async (options = {}) => {
    const force = options.force === true;
    const inFlight = getInFlightEstablish();
    // Always coalesce concurrent establishes. force=true only skips the module cache,
    // it must not stack parallel /auth/me calls that tear down UI mid-flight.
    if (inFlight) {
      return inFlight;
    }

    const run = (async () => {
      setAuthError(null);
      const token = getToken();

      if (!token) {
        clearSessionCache();
        setUser(null);
        setIsAuthenticated(false);
        setNeedsNameSetup(false);
        setIsLoadingAuth(false);
        return null;
      }

      const cached = getCachedSessionUser(token);
      if (!force && cached) {
        applyUserSession(cached);
        setIsLoadingAuth(false);
        return cached;
      }

      // Soft revalidate: keep the visible session while /auth/me refreshes.
      // Hard-clearing user/isLoadingAuth here unmounts Layout children (Profile),
      // resets page refs, and re-triggers force refresh → infinite loading loop.
      const softRefresh = Boolean(force && cached);

      try {
        if (!softRefresh) {
          setIsLoadingAuth(true);
          setUser(null);
          setIsAuthenticated(false);
          setNeedsNameSetup(false);
        }

        const raw = await api.auth.me();
        const currentUser = normalizeSessionUser(raw);

        if (isActiveSessionWithInvalidRole(currentUser)) {
          throw Object.assign(new Error('Сессия недействительна. Войдите снова.'), { status: 401 });
        }

        applyUserSession(currentUser);
        setCachedSessionUser(token, currentUser);
        setIsLoadingAuth(false);
        return currentUser;
      } catch (error) {
        clearSessionCache();
        setUser(null);
        setIsAuthenticated(false);
        setNeedsNameSetup(false);
        setIsLoadingAuth(false);

        if (error?.status === 401 || error?.status === 403) {
          setToken(null);
          setAuthError({
            type: 'auth_required',
            message: 'Требуется вход в систему.',
          });
        }
        return null;
      }
    })();

    setInFlightEstablish(run);
    try {
      return await run;
    } finally {
      if (getInFlightEstablish() === run) {
        clearInFlightEstablish();
      }
    }
  }, [applyUserSession]);

  establishSessionRef.current = establishSession;

  useEffect(() => {
    void establishSession();
  }, [establishSession]);

  useEffect(() => {
    return onTokenChange(() => {
      clearSessionCache();
      void establishSessionRef.current?.({ force: true });
    });
  }, []);

  const logout = useCallback(() => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setIsLoggingOut(true);

    // CRITICAL: clear token synchronously FIRST.
    // If we clear isAuthenticated while the token remains, auth-gate treats it as
    // partial session (token && !isAuthenticated) → infinite "Загрузка сессии".
    // Push revoke / SW ready must never gate token clear or redirect.
    clearSessionCache();
    clearInFlightEstablish();
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setNeedsNameSetup(false);
    setAuthError(null);
    setIsLoadingAuth(false);

    try {
      disconnectChatSocket();
    } catch {
      /* best-effort */
    }

    void (async () => {
      await Promise.allSettled([
        withTimeout(
          (async () => {
            try {
              const { revokeCurrentDevicePushSubscription } = await import('@/lib/pwa/pushClient');
              await revokeCurrentDevicePushSubscription({
                timeoutMs: LOGOUT_OPTIONAL_TIMEOUT_MS,
              });
            } catch (err) {
              console.warn('[logout] push revoke skipped', err?.message || err);
            }
          })(),
          LOGOUT_OPTIONAL_TIMEOUT_MS,
        ),
        withTimeout(Promise.resolve(clearAllOfflineData()).catch(() => null), LOGOUT_OPTIONAL_TIMEOUT_MS),
      ]);
      window.location.assign('/login');
    })();
  }, []);

  const navigateToLogin = () => {
    api.auth.redirectToLogin(window.location.href);
  };

  const handleNameSetupComplete = (nameData) => {
    setUser((prev) => {
      const next = {
        ...prev,
        first_name: nameData.first_name,
        last_name: nameData.last_name,
        name: `${nameData.last_name} ${nameData.first_name}`.trim(),
        full_name: `${nameData.last_name} ${nameData.first_name}`.trim(),
      };
      const token = getToken();
      if (token) {
        setCachedSessionUser(token, next);
      }
      return next;
    });
    setNeedsNameSetup(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      isLoggingOut,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      establishSession,
      checkAppState: establishSession,
      needsNameSetup,
      handleNameSetupComplete,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
