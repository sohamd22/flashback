'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthState, getAuthState, logout as authLogout } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

interface AuthContextType extends AuthState {
  logout: () => Promise<void>;
  updateAuthUser: (user: User) => void;
  refreshAuth: () => Promise<void>;
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
    user: null,
    session: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial auth check
    refreshAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await refreshAuth();
      } else if (event === 'SIGNED_OUT') {
        setAuthState({ isAuthenticated: false, user: null, session: null });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshAuth = async () => {
    setLoading(true);
    try {
      const state = await getAuthState();
      setAuthState(state);
    } catch (error) {
      console.error('Error refreshing auth:', error);
      setAuthState({ isAuthenticated: false, user: null, session: null });
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await authLogout();
    setAuthState({ isAuthenticated: false, user: null, session: null });
  };

  const updateAuthUser = (user: User) => {
    setAuthState(prev => ({ ...prev, user }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
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