import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const Ctx = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('cpst_token');
    const saved = localStorage.getItem('cpst_user');
    if (token && saved) {
      setUser(JSON.parse(saved));
      authAPI.me()
        .then(r => setUser(r.data.user))
        .catch(logout)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const r = await authAPI.login(email, password);
    localStorage.setItem('cpst_token', r.data.token);
    localStorage.setItem('cpst_user', JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch (_) {}
    localStorage.clear();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be inside AuthProvider');
  return c;
};
