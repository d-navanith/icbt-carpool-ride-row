import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const getUserToken = () =>
  localStorage.getItem('riderow_token') ||
  localStorage.getItem('uniride_token') ||
  null;

const getAdminToken = () => localStorage.getItem('riderow_admin_token') || null;

export const AuthProvider = ({ children }) => {
  const isAdminPath = window.location.pathname.startsWith('/admin');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(isAdminPath ? getAdminToken() : getUserToken());
  const [loading, setLoading] = useState(true);
  const [sessionType, setSessionType] = useState(isAdminPath ? 'admin' : 'user');
  const [activeMode, setActiveMode] = useState(
    localStorage.getItem('riderow_mode') || localStorage.getItem('uniride_mode') || 'passenger'
  );

  useEffect(() => {
    if (token) {
      fetchCurrentUser(token, sessionType);
    } else {
      setLoading(false);
    }
  }, [token, sessionType]);

  const fetchCurrentUser = async (authToken, type = 'user') => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (!res.ok) {
        type === 'admin' ? adminLogout(false) : logout(false);
        return;
      }

      const data = await res.json();

      if (type === 'admin' && data.user?.system_role !== 'admin') {
        adminLogout(false);
        return;
      }

      if (type === 'user' && data.user?.system_role === 'admin') {
        logout(false);
        window.location.assign('/admin/login');
        return;
      }

      setUser(data.user);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    if (data.user?.system_role === 'admin') {
      throw new Error('Administrator accounts must sign in through the Admin Portal.');
    }

    localStorage.setItem('riderow_token', data.token);
    setSessionType('user');
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const adminLogin = async (email, password) => {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Administrator login failed');
    }

    if (data.user?.system_role !== 'admin') {
      throw new Error('Administrator access was not granted.');
    }

    localStorage.setItem('riderow_admin_token', data.token);
    setSessionType('admin');
    setToken(data.token);
    setUser(data.user);
    window.location.assign('/admin');
    return data.user;
  };

  const register = async (formData) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    localStorage.setItem('riderow_token', data.token);
    setSessionType('user');
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = (redirect = true) => {
    localStorage.removeItem('riderow_token');
    localStorage.removeItem('uniride_token');
    localStorage.removeItem('riderow_mode');
    localStorage.removeItem('uniride_mode');
    setToken(null);
    setUser(null);
    setSessionType('user');
    setActiveMode('passenger');
    if (redirect && window.location.pathname.startsWith('/admin')) {
      window.location.assign('/login');
    }
  };

  const adminLogout = (redirect = true) => {
    localStorage.removeItem('riderow_admin_token');
    setToken(null);
    setUser(null);
    setSessionType('admin');
    if (redirect) {
      window.location.assign('/admin/login');
    }
  };

  const switchMode = (mode) => {
    if (mode !== 'passenger' && mode !== 'driver') return;
    setActiveMode(mode);
    localStorage.setItem('riderow_mode', mode);
  };

  const refreshProfile = async () => {
    if (token) {
      await fetchCurrentUser(token, sessionType);
    }
  };

  const updateProfile = async (fields) => {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(fields)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update failed');
    setUser(data.user);
    return data.user;
  };

  const submitDriverVerification = async (form) => {
    const res = await fetch('/api/verification/driver', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Submission failed');
    }
    await refreshProfile();
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        sessionType,
        activeMode,
        switchMode,
        login,
        adminLogin,
        register,
        logout,
        adminLogout,
        refreshProfile,
        updateProfile,
        submitDriverVerification,
        isApprovedDriver: user?.driver_verification?.status === 'approved',
        driverStatus: user?.driver_verification?.status || 'unverified',
        isAdmin: user?.system_role === 'admin'
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
