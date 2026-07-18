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

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({ id: 'longhua-crm', public_settings: { auth_required: true } });
  const [needsNameSetup, setNeedsNameSetup] = useState(false);
  const establishSessionRef = useRef(null);

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
      return;
    }

    if (!currentUser.first_name || !currentUser.last_name) {
      setUser(currentUser);
      setIsAuthenticated(true);
      setNeedsNameSetup(true);
      setAuthError(null);
      return;
    }

    setUser(currentUser);
    setIsAuthenticated(true);
    setNeedsNameSetup(false);
    setAuthError(null);
  }, []);

  /**
   * Single auth initialization path — idempotent, deduped across StrictMode remounts.
   * @param {{ force?: boolean }} options — force=true bypasses module cache (e.g. after profile update)
   */
  const establishSession = useCallback(async (options = {}) => {
    const force = options.force === true;
    const inFlight = getInFlightEstablish();
    if (inFlight && !force) {
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

      if (!force) {
        const cached = getCachedSessionUser(token);
        if (cached) {
          applyUserSession(cached);
          setIsLoadingAuth(false);
          return cached;
        }
      }

      try {
        setIsLoadingAuth(true);
        if (force || getCachedSessionUser(token) == null) {
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
      clearInFlightEstablish();
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
    clearSessionCache();
    setUser(null);
    setIsAuthenticated(false);
    setNeedsNameSetup(false);
    setAuthError(null);
    setIsLoadingAuth(false);
    setToken(null);
    window.location.href = '/login';
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
