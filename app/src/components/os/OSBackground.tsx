'use client';

interface OSBackgroundProps {
  type?: 'gradient' | 'wallpaper' | 'solid';
  color?: string;
}

export default function OSBackground({ type = 'gradient', color = '#000000' }: OSBackgroundProps) {
  if (type === 'wallpaper') {
    return (
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          backgroundImage: `url('/backgrounds/wallpaper.jpg')`,
          backgroundSize: '100% 100%',
          backgroundPosition: '0 0'
        }}
      />
    );
  }

  if (type === 'solid') {
    return (
      <div
        className="absolute inset-0 w-full h-full"
        style={{ backgroundColor: color }}
      />
    );
  }

  return (
    <div
      className="absolute inset-0 w-full h-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500"
      style={{
        backgroundImage: `
          radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
          radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: '64px 64px'
      }}
    />
  );
}