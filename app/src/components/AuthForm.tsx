'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import OSLayout from './os/OSLayout';

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
    <OSLayout
      backgroundType="wallpaper"
      showTopBar={false}
      showTaskbar={true}
    >
      <div className="flex items-center justify-center h-full">
        <div className="bg-gray-300 border-2 border-gray-600 w-80" style={{
          boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255,255,255,0.8), 4px 4px 10px rgba(0,0,0,0.3)'
        }}>
          {/* Window Title Bar */}
          <div className="h-6 bg-gradient-to-r from-blue-600 to-blue-800 border-b border-gray-500 flex items-center justify-between px-2">
            <span className="text-xs text-white font-bold">
              Log On to PhotoOS
            </span>
            <div className="flex gap-1">
              <div className="w-4 h-4 bg-gray-300 border border-gray-600 flex items-center justify-center text-xs font-bold cursor-not-allowed" style={{
                boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)'
              }}>×</div>
            </div>
          </div>

          {/* Window Content */}
          <div className="p-6 bg-gray-300">
            {/* User Icon */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-3 bg-gray-400 border-2 border-gray-600 rounded-full flex items-center justify-center" style={{
                boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,0.8)'
              }}>
                <div className="text-2xl"><img src="/icons/photo_logo.png" alt="User" className="w-full h-full object-cover" /></div>
              </div>
              <div className="text-sm text-gray-800 font-bold">
                {isSignup ? 'Create New User Account' : 'Type your user name and password'}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username/Email Field */}
              <div>
                <label className="block text-xs text-gray-800 mb-1 font-bold">
                  Email:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-2 py-1 text-sm bg-white border-2 border-gray-600 focus:outline-none text-black"
                  style={{
                    boxShadow: 'inset -1px -1px 0px rgba(255,255,255,0.8), inset 1px 1px 0px rgba(0,0,0,0.3)'
                  }}
                  disabled={isLoading}
                />
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-xs text-gray-800 mb-1 font-bold">
                  Password:
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-2 py-1 text-sm bg-white border-2 border-gray-600 focus:outline-none text-black"
                  style={{
                    boxShadow: 'inset -1px -1px 0px rgba(255,255,255,0.8), inset 1px 1px 0px rgba(0,0,0,0.3)'
                  }}
                  disabled={isLoading}
                />
              </div>

              {/* Confirm Password for Signup */}
              {isSignup && (
                <div>
                  <label className="block text-xs text-gray-800 mb-1 font-bold">
                    Confirm password:
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-2 py-1 text-sm bg-white border-2 border-gray-600 focus:outline-none text-black"
                    style={{
                      boxShadow: 'inset -1px -1px 0px rgba(255,255,255,0.8), inset 1px 1px 0px rgba(0,0,0,0.3)'
                    }}
                    disabled={isLoading}
                  />
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-gray-200 border border-gray-600 text-red-800 px-2 py-2 text-xs" style={{
                  boxShadow: 'inset -1px -1px 0px rgba(255,255,255,0.8), inset 1px 1px 0px rgba(0,0,0,0.3)'
                }}>
                  ⚠ {error}
                </div>
              )}

              {/* Main Button */}
              <div className="pt-4 flex justify-center">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-8 py-2 bg-gray-300 border-2 border-gray-600 text-black text-xs font-bold hover:bg-gray-200 focus:outline-none disabled:opacity-50 cursor-pointer"
                  style={{
                    boxShadow: isLoading ? 
                      'inset -1px -1px 0px rgba(255,255,255,0.8), inset 1px 1px 0px rgba(0,0,0,0.3)' :
                      'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,0.8)'
                  }}
                >
                  {isLoading ? 
                    (isSignup ? 'Creating...' : 'Logging On...') : 
                    'OK'
                  }
                </button>
              </div>

              {/* Secondary Action */}
              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup(!isSignup);
                    setError('');
                    setPassword('');
                    setConfirmPassword('');
                  }}
                  className="text-xs text-blue-700 hover:text-blue-900 underline focus:outline-none cursor-pointer"
                  disabled={isLoading}
                >
                  {isSignup ? 'Already have an account? Log in instead' : 'Need an account? Create one'}
                </button>
              </div>
            </form>

            {/* Bottom Status */}
            <div className="mt-4 text-center">
              <div className="text-xs text-gray-600">
                PhotoOS • Photographic Memory Management System
              </div>
            </div>
          </div>
        </div>
      </div>
    </OSLayout>
  );
}