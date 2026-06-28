import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api, getToken, setToken } from '@/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({ id: 'longhua-crm', public_settings: { auth_required: true } });
  const [needsNameSetup, setNeedsNameSetup] = useState(false);

  const applyUserSession = useCallback((currentUser) => {
    if (currentUser.onboarding_state === 'blocked') {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setNeedsNameSetup(false);
      setAuthError({
        type: 'blocked',
        message: 'Account is blocked',
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

  /** Single auth initialization path — used on app load and after login. */
  const establishSession = useCallback(async () => {
    setAuthError(null);

    if (!getToken()) {
      setUser(null);
      setIsAuthenticated(false);
      setNeedsNameSetup(false);
      setIsLoadingAuth(false);
      return null;
    }

    try {
      setIsLoadingAuth(true);
      const currentUser = await api.auth.me();
      applyUserSession(currentUser);
      setIsLoadingAuth(false);
      return currentUser;
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setUser(null);
      setNeedsNameSetup(false);

      if (error.status === 401 || error.status === 403) {
        setToken(null);
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
      }
      return null;
    }
  }, [applyUserSession]);

  useEffect(() => {
    establishSession();
  }, [establishSession]);

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setNeedsNameSetup(false);
    setAuthError(null);
    api.auth.logout();
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin(window.location.href);
  };

  const handleNameSetupComplete = (nameData) => {
    setUser((prev) => ({
      ...prev,
      first_name: nameData.first_name,
      last_name: nameData.last_name,
    }));
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
