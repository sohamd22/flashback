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
  color = '#FFFFFF', // White color
  canvasWidth,
  canvasHeight
}: MemoryConnectionProps) {
  // Pixel art style thickness - discrete values
  const thickness = Math.max(2, Math.floor(2 + (strength * 3))); // 2-5px, pixelated
  const opacity = 0.3 + (strength * 0.4);
  
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
        imageRendering: 'pixelated', // Pixel art rendering
      }}
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="square" // Pixel art style - square caps
        strokeOpacity={opacity}
        strokeDasharray="8,4" // Always dashed for pixel art theme
        style={{
          opacity: opacity,
          transition: 'stroke-dasharray 0.3s ease, stroke-dashoffset 0.3s ease',
          filter: 'drop-shadow(1px 1px 0px rgba(0,0,0,0.3)) drop-shadow(0 0 4px rgba(255,255,255,0.4))', // Pixel art shadow + glow
        }}
      />
    </svg>
  );
}