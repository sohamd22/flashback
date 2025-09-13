import { supabase, Profile } from './supabase';
import { Session } from '@supabase/supabase-js';

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
  session: Session | null;
}

// Convert Supabase profile to app User format
const profileToUser = (profile: Profile): User => ({
  id: profile.id,
  email: profile.email,
  name: profile.name,
  profilePhoto: profile.profile_photo,
  onboardingComplete: profile.onboarding_complete
});

// Get current auth session from Supabase
export const getAuthState = async (): Promise<AuthState> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { isAuthenticated: false, user: null, session: null };
    }

    // Get user profile from database
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      // Create default profile if doesn't exist
      const newProfile: Partial<Profile> = {
        id: session.user.id,
        email: session.user.email!,
        onboarding_complete: false
      };

      await supabase.from('profiles').insert(newProfile);

      return {
        isAuthenticated: true,
        user: {
          id: session.user.id,
          email: session.user.email!,
          onboardingComplete: false
        },
        session
      };
    }

    return {
      isAuthenticated: true,
      user: profileToUser(profile),
      session
    };
  } catch (error) {
    console.error('Error getting auth state:', error);
    return { isAuthenticated: false, user: null, session: null };
  }
};

// Sign up new user
export const signup = async (email: string, password: string): Promise<User> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error('Signup failed');

  // Create user profile
  const profile: Partial<Profile> = {
    id: data.user.id,
    email: data.user.email!,
    onboarding_complete: false
  };

  await supabase.from('profiles').insert(profile);

  return {
    id: data.user.id,
    email: data.user.email!,
    onboardingComplete: false
  };
};

// Login existing user
export const login = async (email: string, password: string): Promise<User> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error('Login failed');

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (!profile) {
    // Create profile if doesn't exist (for existing auth users)
    const newProfile: Partial<Profile> = {
      id: data.user.id,
      email: data.user.email!,
      onboarding_complete: false
    };

    await supabase.from('profiles').insert(newProfile);

    return {
      id: data.user.id,
      email: data.user.email!,
      onboardingComplete: false
    };
  }

  return profileToUser(profile);
};

// Logout user
export const logout = async (): Promise<void> => {
  await supabase.auth.signOut();
};

// Update user profile
export const updateUser = async (userId: string, updates: Partial<User>): Promise<User> => {
  const profileUpdates: Partial<Profile> = {};

  if (updates.name !== undefined) profileUpdates.name = updates.name;
  if (updates.profilePhoto !== undefined) profileUpdates.profile_photo = updates.profilePhoto;
  if (updates.onboardingComplete !== undefined) profileUpdates.onboarding_complete = updates.onboardingComplete;

  const { data, error } = await supabase
    .from('profiles')
    .update(profileUpdates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Update failed');

  return profileToUser(data);
};

// Complete onboarding
export const completeOnboarding = async (userId: string, name: string, profilePhoto: string): Promise<User> => {
  return updateUser(userId, {
    name,
    profilePhoto,
    onboardingComplete: true
  });
};

// Clear auth state (legacy - now handled by Supabase)
export const clearAuthState = logout;
export const setAuthState = () => {
  console.warn('setAuthState is deprecated with Supabase auth');
};