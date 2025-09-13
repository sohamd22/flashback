'use client';

import { connectionStyles } from '@/styles/nodeStyles';

interface BaseConnectionProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  strength?: number;
  color?: string;
  animated?: boolean;
  dashed?: boolean;
  width: number;
  height: number;
  className?: string;
}

export default function BaseConnection({
  fromX,
  fromY,
  toX,
  toY,
  strength = 0.5,
  color = '#FFFFFF', // White color
  animated = true,
  dashed = true, // Always dashed for pixel art theme
  width,
  height,
  className = ''
}: BaseConnectionProps) {
  // Pixel art style thickness - discrete values
  const thickness = Math.max(2, Math.floor(2 + (strength * 3))); // 2-5px, pixelated
  
  const opacity = connectionStyles.opacity.min + 
    (strength * (connectionStyles.opacity.max - connectionStyles.opacity.min));

  // Grayscale glow based on similarity (min 0.5)
  const glowIntensity = Math.max(0.5, strength);
  const glowColor = `rgba(${Math.floor(255 * glowIntensity)}, ${Math.floor(255 * glowIntensity)}, ${Math.floor(255 * glowIntensity)}, 0.6)`;

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        pointerEvents: 'none',
        zIndex: 1,
        imageRendering: 'pixelated', // Pixel art rendering
      }}
      className={animated ? connectionStyles.animation.fade : ''}
    >
      <line
        x1={fromX}
        y1={fromY}
        x2={toX}
        y2={toY}
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="square" // Pixel art style - square caps
        strokeOpacity={opacity}
        strokeDasharray={dashed ? '8,4' : 'none'} // Retro dashed pattern
        className={className}
        style={{
          filter: `drop-shadow(1px 1px 0px rgba(0,0,0,0.3)) drop-shadow(0 0 6px ${glowColor}) drop-shadow(0 0 12px ${glowColor})`, // Pixel art shadow + grayscale glow
        }}
      />
    </svg>
  );
}
