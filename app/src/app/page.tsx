'use client';

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import AuthForm from '@/components/AuthForm';
import Onboarding from '@/components/Onboarding';
import OSPage from '@/components/OSPageSimplified';

function AppContent() {
  const { user, profile, isLoading, logout } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!user) {
      setShowAuth(true);
      setShowOnboarding(false);
    } else if (profile && !profile.onboarding_complete) {
      setShowAuth(false);
      setShowOnboarding(true);
    } else {
      setShowAuth(false);
      setShowOnboarding(false);
    }
  }, [user, profile]);

  if (showAuth) {
    return (
      <AuthForm
        onSuccess={() => setShowAuth(false)}
      />
    );
  }

  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={() => setShowOnboarding(false)}
      />
    );
  }

  return <OSPage />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
