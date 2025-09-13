'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface AuthFormProps {
  onSuccess?: () => void;
}

export default function AuthForm({ onSuccess }: AuthFormProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, signup } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email || !password) {
      setError('Email and password are required');
      setIsLoading(false);
      return;
    }

    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    try {
      const result = isSignup
        ? await signup(email, password)
        : await login(email, password);

      if (result.error) {
        setError(result.error);
        setIsLoading(false);
      } else {
        // Success - redirect
        if (onSuccess) {
          onSuccess();
        } else {
          router.push('/');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="w-full h-screen bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 relative overflow-hidden select-none"
      style={{
        backgroundImage: `
          radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
          radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: '64px 64px'
      }}
    >
      {/* Top Bar */}
      <div className="h-8 bg-gray-800 border-b-2 border-gray-600 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="text-white font-bold text-sm">PhotoOS</div>
        </div>
        <div className="text-white text-sm font-mono">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Login Window */}
      <div className="flex items-center justify-center h-full">
        <div className="bg-gray-100 border-2 border-gray-600 shadow-2xl w-96">
          {/* Window Title Bar */}
          <div className="h-8 bg-gradient-to-r from-gray-300 to-gray-400 border-b-2 border-gray-600 flex items-center justify-between px-2">
            <span className="text-sm font-bold text-gray-800">
              {isSignup ? 'Create Account' : 'User Login'}
            </span>
            <div className="flex gap-1">
              <div className="w-6 h-6 bg-red-400 border border-red-600 flex items-center justify-center text-xs font-bold">×</div>
            </div>
          </div>

          {/* Window Content */}
          <div className="p-8 bg-white">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Photographic
              </h1>
              <p className="text-gray-600 text-sm">
                {isSignup ? 'Welcome to PhotoOS' : 'Welcome back to PhotoOS'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Email Address:
                </label>
                <input
                  type="email"
                  placeholder="user@photographic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-400 focus:border-blue-500 focus:outline-none bg-white text-black"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Password:
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-400 focus:border-blue-500 focus:outline-none bg-white text-black"
                  disabled={isLoading}
                />
              </div>

              {isSignup && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Confirm Password:
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-400 focus:border-blue-500 focus:outline-none bg-white text-black"
                    disabled={isLoading}
                  />
                </div>
              )}

              {error && (
                <div className="bg-red-100 border-2 border-red-400 text-red-700 px-3 py-2 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-gray-300 border-2 border-gray-600 text-black font-bold hover:bg-gray-400 focus:outline-none transition-all duration-150 disabled:opacity-50"
                  style={{
                    boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,0.8)'
                  }}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                      {isSignup ? 'Creating...' : 'Logging in...'}
                    </span>
                  ) : (
                    isSignup ? 'Create Account' : 'Log In'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSignup(!isSignup);
                    setError('');
                    setPassword('');
                    setConfirmPassword('');
                  }}
                  className="px-4 py-2 bg-gray-300 border-2 border-gray-600 text-black font-bold hover:bg-gray-400 focus:outline-none transition-all duration-150"
                  style={{
                    boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,0.8)'
                  }}
                  disabled={isLoading}
                >
                  {isSignup ? 'Already have an account? Sign in' : 'No account? Sign up'}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                PhotoOS v1.0 - Photographic Memory Management System
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Taskbar */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gray-800 border-t-2 border-gray-600 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-sm rounded hover:from-blue-600 hover:to-purple-700 transition-all">
            Start
          </button>
        </div>
        <div className="text-white text-xs font-mono">
          {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}