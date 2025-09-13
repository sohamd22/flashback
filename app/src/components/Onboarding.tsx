'use client';

import { useState, useRef } from 'react';
import { completeOnboarding } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [name, setName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { updateAuthUser } = useAuth();


  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setError('');
      setProfilePhoto(imageData);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!profilePhoto) {
      setError('Profile photo is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Get the current user
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        throw new Error('No authenticated user found');
      }

      // Upload profile photo to Supabase Storage (optional - for now we'll use base64)
      // In production, you'd want to upload to Supabase Storage or another service
      // For now, we'll store the base64 string in the database

      // Complete onboarding in database
      const user = await completeOnboarding(authUser.id, name.trim(), profilePhoto);
      updateAuthUser(user);
      onComplete();
    } catch (err: any) {
      console.error('Onboarding error:', err);
      setError(err.message || 'Failed to complete onboarding');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extralight text-white mb-4">
            Welcome
          </h1>
          <p className="text-gray-500 text-sm">
            Let's set up your profile
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-white text-sm font-medium mb-3">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-4 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 transition-all duration-200"
              placeholder="Enter your full name"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-3">
              Profile Photo
            </label>
            
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
                dragActive 
                  ? 'border-gray-500 bg-gray-900' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
            >
              {profilePhoto ? (
                <div className="space-y-4">
                  <div className="relative inline-block">
                    <img
                      src={profilePhoto}
                      alt="Profile preview"
                      className="w-32 h-32 object-cover rounded-full mx-auto border-2 border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setProfilePhoto(null);
                      }}
                      className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                  <p className="text-green-400 text-sm">
                    ✓ Photo looks good!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-24 h-24 bg-gray-800 rounded-full mx-auto flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-300 mb-2">
                      Drop your photo here, or{' '}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-white underline hover:no-underline"
                      >
                        browse
                      </button>
                    </p>
                    <p className="text-gray-500 text-xs">
                      PNG, JPG up to 5MB
                    </p>
                  </div>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                className="hidden"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !name.trim() || !profilePhoto}
            className="w-full py-4 bg-white text-black font-medium rounded-lg hover:bg-gray-100 focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                Completing Setup...
              </span>
            ) : (
              'Complete Setup'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}