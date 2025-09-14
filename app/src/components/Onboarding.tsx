'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import OSLayout from './os/OSLayout';

interface OnboardingProps {
  onComplete?: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [name, setName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { updateProfile } = useAuth();
  const router = useRouter();

  const startCamera = async () => {
    setShowCamera(true);
    setError('');
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        setProfilePhoto(imageData);
        stopCamera();
      }
    }
  };

  useEffect(() => {
    const initCamera = async () => {
      if (showCamera && videoRef.current) {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 480 }
            },
            audio: false
          });
          setStream(mediaStream);
          videoRef.current.srcObject = mediaStream;
        } catch (err) {
          setError('Unable to access camera. Please check permissions.');
          console.error('Camera access error:', err);
          setShowCamera(false);
        }
      }
    };

    if (showCamera) {
      initCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showCamera]);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Prevent HEIC/HEIF uploads
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.heic') || fileName.endsWith('.heif') ||
        file.type === 'image/heic' || file.type === 'image/heif') {
      setError('HEIC/HEIF format not supported. Please use JPG, PNG, or other standard formats.');
      return;
    }

    // Only allow specific image formats
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please use JPG, PNG, GIF, or WebP format');
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
      const result = await updateProfile({
        name: name.trim(),
        profile_photo: profilePhoto,
        onboarding_complete: true,
      });

      if (result.error) {
        setError(result.error);
        setIsLoading(false);
      } else {
        if (onComplete) {
          onComplete();
        } else {
          router.push('/');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding');
      setIsLoading(false);
    }
  };

  return (
    <OSLayout
      backgroundType="gradient"
      showTopBar={true}
      topBarTitle="PhotoOS - Setup"
      showTaskbar={true}
    >
      <div className="flex items-center justify-center h-full">
        <div className="bg-gray-100 border-2 border-gray-600 shadow-2xl w-[500px]">
          {/* Window Title Bar */}
          <div className="h-8 bg-gradient-to-r from-gray-300 to-gray-400 border-b-2 border-gray-600 flex items-center justify-between px-2">
            <span className="text-sm font-bold text-gray-800">
              Profile Setup
            </span>
            <div className="flex gap-1">
              <div className="w-6 h-6 bg-red-400 border border-red-600 flex items-center justify-center text-xs font-bold">×</div>
            </div>
          </div>

          {/* Window Content */}
          <div className="p-8 bg-white">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Welcome to Photographic
              </h1>
              <p className="text-gray-600 text-sm">
                Complete your profile setup
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Your Name:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-400 focus:border-blue-500 focus:outline-none bg-white text-black"
                  placeholder="Enter your full name"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Profile Photo:
                </label>

                <div
                  className={`relative border-2 border-gray-400 p-6 text-center transition-all duration-200 bg-gray-50 ${
                    dragActive
                      ? 'border-blue-500 bg-gray-100'
                      : 'hover:border-gray-500'
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
                          className="w-32 h-32 object-cover border-2 border-gray-400 mx-auto"
                          style={{ imageRendering: 'auto' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setProfilePhoto(null);
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-gray-300 border-2 border-gray-600 flex items-center justify-center text-xs font-bold hover:bg-gray-400"
                          style={{
                            boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)'
                          }}
                        >
                          X
                        </button>
                      </div>
                      <p className="text-green-600 text-sm font-bold">
                        ✓ Photo uploaded successfully
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-24 h-24 bg-gray-200 border-2 border-gray-400 mx-auto flex items-center justify-center">
                        <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-gray-700 mb-2">
                          Drop your photo here, or{' '}
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-blue-600 underline hover:text-blue-800"
                          >
                            browse
                          </button>
                          {' '}or{' '}
                          <button
                            type="button"
                            onClick={startCamera}
                            className="text-blue-600 underline hover:text-blue-800"
                          >
                            take photo
                          </button>
                        </p>
                        <p className="text-gray-500 text-xs">
                          JPG, PNG, GIF, WebP up to 5MB (HEIC not supported)
                        </p>
                      </div>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                    className="hidden"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-100 border-2 border-red-400 text-red-700 px-3 py-2 text-sm">
                  {error}
                </div>
              )}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading || !name.trim() || !profilePhoto}
                  className="w-full px-4 py-2 bg-gray-300 border-2 border-gray-600 text-black font-bold hover:bg-gray-400 focus:outline-none transition-all duration-150 disabled:opacity-50"
                  style={{
                    boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,0.8)'
                  }}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                      Completing Setup...
                    </span>
                  ) : (
                    'Complete Setup'
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                PhotoOS v1.0 - Profile Configuration
              </p>
            </div>
          </div>
        </div>

        {/* Camera Modal */}
        {showCamera && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-100 border-2 border-gray-600 shadow-2xl">
              {/* Window Title Bar */}
              <div className="h-8 bg-gradient-to-r from-gray-300 to-gray-400 border-b-2 border-gray-600 flex items-center justify-between px-2">
                <span className="text-sm font-bold text-gray-800">
                  Camera Capture
                </span>
                <button
                  onClick={stopCamera}
                  className="w-6 h-6 bg-red-400 border border-red-600 flex items-center justify-center text-xs font-bold hover:bg-red-500"
                >
                  ×
                </button>
              </div>

              {/* Camera Content */}
              <div className="p-4 bg-white">
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="border-2 border-gray-400 bg-black"
                    style={{ width: '640px', height: '480px', objectFit: 'cover' }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />
                </div>

                <div className="mt-4 flex justify-center gap-3">
                  <button
                    onClick={capturePhoto}
                    className="px-6 py-2 bg-blue-500 border-2 border-blue-700 text-white font-bold hover:bg-blue-600"
                    style={{
                      boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,0.3)'
                    }}
                  >
                    📸 Capture
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-6 py-2 bg-gray-300 border-2 border-gray-600 text-black font-bold hover:bg-gray-400"
                    style={{
                      boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,0.8)'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </OSLayout>
  );
}