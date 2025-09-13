export interface User {
  id: string;
  email: string;
  name?: string;
  profilePhoto?: string;
  onboardingComplete: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

const AUTH_STORAGE_KEY = 'photographic_auth';

export const getAuthState = (): AuthState => {
  if (typeof window === 'undefined') {
    return { isAuthenticated: false, user: null };
  }

  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) {
      return { isAuthenticated: false, user: null };
    }
    
    const parsed = JSON.parse(stored);
    return {
      isAuthenticated: true,
      user: parsed
    };
  } catch {
    return { isAuthenticated: false, user: null };
  }
};

export const setAuthState = (user: User): void => {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
};

export const clearAuthState = (): void => {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const login = (email: string, password: string): User => {
  const user: User = {
    id: crypto.randomUUID(),
    email,
    onboardingComplete: false
  };
  
  setAuthState(user);
  return user;
};

export const signup = (email: string, password: string): User => {
  return login(email, password);
};

export const updateUser = (updates: Partial<User>): User => {
  const currentAuth = getAuthState();
  if (!currentAuth.user) {
    throw new Error('No user logged in');
  }
  
  const updatedUser = { ...currentAuth.user, ...updates };
  setAuthState(updatedUser);
  return updatedUser;
};

export const completeOnboarding = (name: string, profilePhoto: string): User => {
  return updateUser({
    name,
    profilePhoto,
    onboardingComplete: true
  });
};