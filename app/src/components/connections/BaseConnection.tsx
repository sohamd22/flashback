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
  color = 'rgba(156, 163, 175, 0.4)',
  animated = true,
  dashed = false,
  width,
  height,
  className = ''
}: BaseConnectionProps) {
  const thickness = connectionStyles.thickness.min + 
    (strength * (connectionStyles.thickness.max - connectionStyles.thickness.min));
  
  const opacity = connectionStyles.opacity.min + 
    (strength * (connectionStyles.opacity.max - connectionStyles.opacity.min));

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
        strokeLinecap="round"
        strokeOpacity={opacity}
        strokeDasharray={dashed ? '5,5' : 'none'}
        className={className}
      />
    </svg>
  );
}