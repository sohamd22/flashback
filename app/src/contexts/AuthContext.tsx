'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthState, getAuthState, clearAuthState } from '@/lib/auth';

interface AuthContextType extends AuthState {
  logout: () => void;
  updateAuthUser: (user: User) => void;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setAuthState(getAuthState());
    setMounted(true);
  }, []);

  const logout = () => {
    clearAuthState();
    setAuthState({ isAuthenticated: false, user: null });
  };

  const updateAuthUser = (user: User) => {
    setAuthState({ isAuthenticated: true, user });
  };

  const refreshAuth = () => {
    setAuthState(getAuthState());
  };

  if (!mounted) {
    return null;
  }

  return (
    <AuthContext.Provider value={{
      ...authState,
      logout,
      updateAuthUser,
      refreshAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};