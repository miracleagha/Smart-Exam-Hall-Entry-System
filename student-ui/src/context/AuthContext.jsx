import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

/**
 * Persist the student session shape ({ accessToken, refreshToken, student,
 * institution }) back to localStorage, replacing only the fields we own.
 */
const persistSession = (patch) => {
  try {
    const raw = localStorage.getItem('student_session');
    const session = raw ? JSON.parse(raw) : {};
    const next = { ...session, ...patch };
    localStorage.setItem('student_session', JSON.stringify(next));
  } catch (_err) {
    // If localStorage is unavailable (private mode, quota), we silently
    // continue with in-memory state.
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [institution, setInstitution] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticatedRef = useRef(false);

  // Restore session from localStorage on mount
  useEffect(() => {
    const session = localStorage.getItem('student_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (parsed.student) {
          setUser(parsed.student);
          setInstitution(parsed.institution || null);
          isAuthenticatedRef.current = true;
        }
      } catch (e) {
        localStorage.removeItem('student_session');
      }
    }
    setLoading(false);
  }, []);

  /**
   * Pull the freshest student record from the backend. This is how the
   * student picks up institution-side edits like a newly-uploaded passport
   * photo — without it, the profile shown to the student is stuck on
   * whatever was in localStorage at login time.
   */
  const refreshUser = useCallback(async () => {
    if (!isAuthenticatedRef.current) return null;
    try {
      const fresh = await api.profile.get();
      if (!fresh) return null;
      setUser((prev) => {
        // Preserve any client-only fields (there shouldn't be any today,
        // but merging is safer than overwriting).
        const merged = { ...(prev || {}), ...fresh };
        persistSession({ student: merged });
        return merged;
      });
      return fresh;
    } catch (_err) {
      // Non-fatal: if the refresh 401s, the response interceptor will kick
      // the user back to the login page. Anything else we simply ignore.
      return null;
    }
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const session = await api.auth.login(username, password);
      setUser(session.student);
      setInstitution(session.institution || null);
      isAuthenticatedRef.current = true;
      return session.student;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.auth.logout();
      setUser(null);
      setInstitution(null);
      isAuthenticatedRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (formData) => {
    if (!user) return;
    const updated = await api.profile.update(formData);
    // Merge updated fields into user state
    const newUser = { ...user, ...updated };
    setUser(newUser);
    persistSession({ student: newUser });
    return newUser;
  };

  // Re-fetch the profile whenever the tab regains focus — cheap way to
  // pick up institution-side edits (e.g. a passport photo added while the
  // student's tab was in the background).
  useEffect(() => {
    const onFocus = () => {
      refreshUser();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshUser();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshUser]);

  const value = {
    user,
    institution,
    loading,
    login,
    logout,
    updateProfile,
    refreshUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
