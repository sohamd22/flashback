'use client';

interface MemoryConnectionProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  strength: number;
  color?: string;
  canvasWidth: number;
  canvasHeight: number;
}

export default function MemoryConnection({
  from,
  to,
  strength,
  color = 'rgba(156, 163, 175, 0.6)',
  canvasWidth,
  canvasHeight
}: MemoryConnectionProps) {
  const opacity = 0.2 + (strength * 0.5);
  const thickness = 1 + (strength * 2);
  
  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: canvasWidth,
        height: canvasHeight,
        pointerEvents: 'none',
        zIndex: 1,
        opacity: 1,
        transition: 'opacity 0.4s ease-in-out',
      }}
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
        style={{
          opacity: opacity,
          transition: 'stroke-dasharray 0.3s ease, stroke-dashoffset 0.3s ease'
        }}
      />
    </svg>
  );
}