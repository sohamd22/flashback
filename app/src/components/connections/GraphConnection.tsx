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
  canvasHeight,
  type = 'friendship'
}: GraphConnectionProps) {
  // Pixel art style thickness - discrete values
  const thickness = Math.max(2, Math.floor(2 + (strength * 3))); // 2-5px, pixelated
  const opacity = 0.3 + (strength * 0.4);
  
  // Grayscale glow based on similarity (min 0.5)
  const glowIntensity = Math.max(0.5, strength);
  const glowColor = `rgba(${Math.floor(255 * glowIntensity)}, ${Math.floor(255 * glowIntensity)}, ${Math.floor(255 * glowIntensity)}, 0.6)`;
  
  // White color for all connection types
  const getConnectionColor = () => {
    return '#FFFFFF'; // White
  };

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
        imageRendering: 'pixelated', // Pixel art rendering
      }}
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={getConnectionColor()}
        strokeWidth={thickness}
        strokeLinecap="square" // Pixel art style - square caps
        strokeOpacity={opacity}
        strokeDasharray="4,10" // Always dashed for pixel art theme
        style={{
          filter: `drop-shadow(1px 1px 0px rgba(0,0,0,0.3)) drop-shadow(0 0 6px ${glowColor}) drop-shadow(0 0 12px ${glowColor})`, // Pixel art shadow + grayscale glow
        }}
      />
    </svg>
  );
}
