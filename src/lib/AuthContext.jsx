import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44, getToken } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({ id: 'longhua-crm', public_settings: { auth_required: true } });
  const [needsNameSetup, setNeedsNameSetup] = useState(false);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    setAuthError(null);
    if (!getToken()) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      return;
    }
    await checkUserAuth();
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();

      if (!currentUser.first_name || !currentUser.last_name) {
        setUser(currentUser);
        setIsAuthenticated(true);
        setNeedsNameSetup(true);
        setIsLoadingAuth(false);
        return;
      }

      if (currentUser.role === 'user') {
        const [teacherRecords, studentRecords] = await Promise.all([
          base44.entities.Teacher.filter({ user_id: currentUser.id }),
          base44.entities.Student.filter({ user_id: currentUser.id }),
        ]);
        if (teacherRecords.length > 0) {
          await base44.auth.updateMe({ role: 'teacher' });
          currentUser.role = 'teacher';
        } else if (studentRecords.length > 0) {
          await base44.auth.updateMe({ role: 'student' });
          currentUser.role = 'student';
        } else {
          currentUser.role = 'pending';
        }
      }

      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);

      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
      }
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setNeedsNameSetup(false);
    setAuthError(null);
    base44.auth.logout();
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
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
      checkAppState,
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
