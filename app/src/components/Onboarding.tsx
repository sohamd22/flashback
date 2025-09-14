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
      backgroundType="wallpaper"
      showTopBar={false}
      showTaskbar={true}
    >
      <div className="flex items-center justify-center h-full">
        <div className="bg-gray-300 border-2 border-gray-600 w-96" style={{
          boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255,255,255,0.8), 4px 4px 10px rgba(0,0,0,0.3)'
        }}>
          {/* Window Title Bar */}
          <div className="h-6 bg-gradient-to-r from-blue-600 to-blue-800 border-b border-gray-500 flex items-center justify-between px-2">
            <span className="text-xs text-white font-bold">
              FlashOS User Setup Wizard
            </span>
            <div className="flex gap-1">
              <div className="w-4 h-4 bg-gray-300 border border-gray-600 flex items-center justify-center text-xs font-bold cursor-not-allowed" style={{
                boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)'
              }}>×</div>
            </div>
          </div>

          {/* Window Content */}
          <div className="p-6 bg-gray-300">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-400 border-2 border-gray-600 rounded flex items-center justify-center" style={{
                boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,0.8)'
              }}>
                <div className="text-lg" style={{
                  paddingRight: '4px'
                }}><img src="/icons/photo_logo.png" alt="User" className="w-full h-full object-cover" /></div>
              </div>
              <div className="text-sm text-gray-800 font-bold mb-1">
                Welcome to FlashOS Setup
              </div>
              <div className="text-xs text-gray-600">
                Please complete your user profile
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Field */}
              <div>
                <label className="block text-xs text-gray-800 mb-1 font-bold">
                  Full name:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-2 py-1 text-sm bg-white border-2 border-gray-600 focus:outline-none text-black"
                  style={{
                    boxShadow: 'inset -1px -1px 0px rgba(255,255,255,0.8), inset 1px 1px 0px rgba(0,0,0,0.3)'
                  }}
                  placeholder="Enter your full name"
                  disabled={isLoading}
                />
              </div>

              {/* Profile Photo Section */}
              <div>
                <label className="block text-xs text-gray-800 mb-1 font-bold">
                  Profile picture:
                </label>

                <div
                  className={`relative border-2 border-gray-600 p-4 text-center bg-gray-200 ${
                    dragActive ? 'bg-gray-100' : ''
                  }`}
                  style={{
                    boxShadow: 'inset -1px -1px 0px rgba(255,255,255,0.8), inset 1px 1px 0px rgba(0,0,0,0.3)'
                  }}
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                >
                  {profilePhoto ? (
                    <div className="space-y-3">
                      <div className="relative inline-block">
                        <img
                          src={profilePhoto}
                          alt="Profile preview"
                          className="w-24 h-24 object-cover border-2 border-gray-600 mx-auto"
                          style={{ 
                            imageRendering: 'auto',
                            boxShadow: 'inset -1px -1px 0px rgba(255,255,255,0.8), inset 1px 1px 0px rgba(0,0,0,0.3)'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setProfilePhoto(null);
                          }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-gray-300 border border-gray-600 flex items-center justify-center text-xs font-bold hover:bg-gray-400"
                          style={{
                            boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)'
                          }}
                        >
                          ×
                        </button>
                      </div>
                      <div className="text-xs text-gray-700">
                        Picture loaded successfully
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-gray-400 border-2 border-gray-600 mx-auto flex items-center justify-center" style={{
                        boxShadow: 'inset -1px -1px 0px rgba(255,255,255,0.8), inset 1px 1px 0px rgba(0,0,0,0.3)'
                      }}>
                        <div className="text-lg">📷</div>
                      </div>
                      <div className="text-xs text-gray-800">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs px-2 py-1 bg-gray-300 border border-gray-600 hover:bg-gray-200 mr-1"
                          style={{
                            boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)'
                          }}
                        >
                          Browse...
                        </button>
                        <button
                          type="button"
                          onClick={startCamera}
                          className="text-xs px-2 py-1 bg-gray-300 border border-gray-600 hover:bg-gray-200"
                          style={{
                            boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)'
                          }}
                        >
                          Camera
                        </button>
                      </div>
                      <div className="text-xs text-gray-600">
                        JPG, PNG, GIF formats supported (max 5MB)
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

              {/* Error Message */}
              {error && (
                <div className="bg-gray-200 border border-gray-600 text-red-800 px-2 py-2 text-xs" style={{
                  boxShadow: 'inset -1px -1px 0px rgba(255,255,255,0.8), inset 1px 1px 0px rgba(0,0,0,0.3)'
                }}>
                  ⚠ {error}
                </div>
              )}

              {/* Buttons */}
              <div className="pt-4 flex justify-center gap-3">
                <button
                  type="submit"
                  disabled={isLoading || !name.trim() || !profilePhoto}
                  className="px-6 py-2 bg-gray-300 border-2 border-gray-600 text-black text-xs font-bold hover:bg-gray-200 focus:outline-none disabled:opacity-50 cursor-pointer"
                  style={{
                    boxShadow: isLoading ? 
                      'inset -1px -1px 0px rgba(255,255,255,0.8), inset 1px 1px 0px rgba(0,0,0,0.3)' :
                      'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,0.8)'
                  }}
                >
                  {isLoading ? 'Setting up...' : 'Finish'}
                </button>
              </div>
            </form>

            {/* Bottom Status */}
            <div className="mt-4 text-center">
              <div className="text-xs text-gray-600">
                FlashOS Setup • Step 1 of 1
              </div>
            </div>
          </div>
        </div>

        {/* Camera Modal */}
        {showCamera && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-gray-300 border-2 border-gray-600" style={{
              boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255,255,255,0.8), 4px 4px 10px rgba(0,0,0,0.3)'
            }}>
              {/* Window Title Bar */}
              <div className="h-6 bg-gradient-to-r from-blue-600 to-blue-800 border-b border-gray-500 flex items-center justify-between px-2">
                <span className="text-xs text-white font-bold">
                  Camera Capture - FlashOS
                </span>
                <button
                  onClick={stopCamera}
                  className="w-4 h-4 bg-gray-300 border border-gray-600 flex items-center justify-center text-xs font-bold hover:bg-gray-400"
                  style={{
                    boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Camera Content */}
              <div className="p-4 bg-gray-300">
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="border-2 border-gray-600 bg-black"
                    style={{ 
                      width: '320px', 
                      height: '240px', 
                      objectFit: 'cover',
                      boxShadow: 'inset -1px -1px 0px rgba(255,255,255,0.8), inset 1px 1px 0px rgba(0,0,0,0.3)'
                    }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />
                </div>

                <div className="mt-3 flex justify-center gap-2">
                  <button
                    onClick={capturePhoto}
                    className="px-4 py-1 bg-gray-300 border-2 border-gray-600 text-black text-xs font-bold hover:bg-gray-200"
                    style={{
                      boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,0.8)'
                    }}
                  >
                    Capture
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-4 py-1 bg-gray-300 border-2 border-gray-600 text-black text-xs font-bold hover:bg-gray-200"
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