'use client';

import { useState, useRef, useEffect } from 'react';
import { VideoClip } from '@/hooks/useVideoAPI';

interface RetroVideoPlayerProps {
  video: VideoClip;
  width?: number;
  height?: number;
  onClose?: () => void;
  onToggleFavorite?: (video: VideoClip) => void;
  isFavorite?: boolean;
}

export default function RetroVideoPlayer({ 
  video, 
  width = 400, 
  height = 300, 
  onClose,
  onToggleFavorite,
  isFavorite = false
}: RetroVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = (parseFloat(e.target.value) / 100) * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const newVolume = parseFloat(e.target.value) / 100;
    setVolume(newVolume);
    if (video) {
      video.volume = newVolume;
    }
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="bg-gray-300 border-2 border-gray-400 relative"
      style={{ 
        width: width + 20,
        height: height + 80,
        fontFamily: 'monospace',
        fontSize: '11px',
        boxShadow: 'inset 2px 2px 0 white, inset -2px -2px 0 #666'
      }}
    >
      {/* Title bar */}
      <div className="bg-blue-800 text-white px-2 py-1 text-xs flex items-center justify-between">
        <span>🎬 {video.query || 'Clip'}</span>
        <div className="flex items-center gap-1">
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(video)}
              className="px-1 py-0 bg-gray-200 text-black border border-gray-400 hover:bg-gray-300"
              style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 gray' }}
            >
              {isFavorite ? '⭐' : '☆'}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="px-2 py-0 bg-red-500 text-white border border-red-600 hover:bg-red-600"
              style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 #800' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Video container */}
      <div 
        className="bg-black border border-gray-400 m-2"
        style={{ 
          width: width,
          height: height,
          boxShadow: 'inset 1px 1px 0 gray'
        }}
      >
        <video
          ref={videoRef}
          src={video.url}
          width={width}
          height={height}
          className="w-full h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Controls */}
      <div className="px-2 pb-2">
        {/* Play/Pause and Favorite */}
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={togglePlay}
            className="px-3 py-1 bg-gray-200 border border-gray-400 hover:bg-gray-300 text-xs"
            style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 gray' }}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          
          <div className="flex-1 text-xs text-gray-700">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
          
          <button
            onClick={toggleMute}
            className="px-2 py-1 bg-gray-200 border border-gray-400 hover:bg-gray-300 text-xs"
            style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 gray' }}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-1">
          <input
            type="range"
            min="0"
            max="100"
            value={duration > 0 ? (currentTime / duration) * 100 : 0}
            onChange={handleSeek}
            className="w-full h-1 bg-gray-400 rounded-none appearance-none"
            style={{
              background: `linear-gradient(to right, #0066cc 0%, #0066cc ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #ccc ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #ccc 100%)`
            }}
          />
        </div>

        {/* Volume control */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-700 min-w-[30px]">Vol:</span>
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume * 100}
            onChange={handleVolumeChange}
            className="flex-1 h-1 bg-gray-400 rounded-none appearance-none"
            style={{
              background: `linear-gradient(to right, #0066cc 0%, #0066cc ${isMuted ? 0 : volume * 100}%, #ccc ${isMuted ? 0 : volume * 100}%, #ccc 100%)`
            }}
          />
          <span className="text-xs text-gray-700 min-w-[20px]">
            {Math.round((isMuted ? 0 : volume) * 100)}
          </span>
        </div>
      </div>
    </div>
  );
}