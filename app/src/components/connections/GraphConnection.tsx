'use client';

interface GraphConnectionProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  strength: number;
  canvasWidth: number;
  canvasHeight: number;
  type?: 'friendship' | 'similarity';
}

export default function GraphConnection({
  from,
  to,
  strength,
  canvasWidth,
  canvasHeight
}: GraphConnectionProps) {
  const thickness = 1 + (strength * 3);
  const opacity = 0.2 + (strength * 0.5);
  
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
      }}
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={`rgba(156, 163, 175, ${opacity})`}
        strokeWidth={thickness}
        strokeLinecap="round"
      />
    </svg>
  );
}
