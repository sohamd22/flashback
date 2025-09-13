'use client';

interface DesktopIconProps {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number;
  onDoubleClick: () => void;
}

export default function DesktopIcon({ id, name, icon, x, y, onDoubleClick }: DesktopIconProps) {
  return (
    <div
      key={id}
      className="absolute cursor-pointer hover:bg-gray-800/40 hover:border-2 hover:border-white/60 p-1 transition-all duration-150"
      style={{ 
        left: x, 
        top: y,
        border: '2px solid transparent',
        imageRendering: 'pixelated',
        width: '80px'
      }}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex flex-col items-center gap-0.25 w-full" style={{ 
        minHeight: '70px'
      }}>
        <img src={icon} alt={name} className="w-full h-full object-cover" />
        <span className="text-white text-xs font-bold text-center leading-tight w-full" style={{ 
          fontFamily: 'monospace',
          wordWrap: 'break-word',
          fontSize: '10px'
        }}>
          {name}
        </span>
      </div>
    </div>
  );
}