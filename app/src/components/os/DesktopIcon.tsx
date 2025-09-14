'use client';

interface DesktopIconProps {
  id: string;
  name: string;
  icon: string;
  onDoubleClick: () => void;
  badgeCount?: number;
  position?: 'start' | 'end'; // For special positioning like trash
}

export default function DesktopIcon({ id, name, icon, onDoubleClick, badgeCount, position }: DesktopIconProps) {
  return (
    <div
      key={id}
      className="cursor-pointer hover:bg-gray-800/40 hover:border-2 hover:border-white/60 p-2 transition-all duration-150 flex flex-col items-center"
      style={{ 
        border: '2px solid transparent',
        imageRendering: 'pixelated',
        width: '100px'
      }}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex flex-col items-center gap-1 w-full" style={{ 
        minHeight: '90px'
      }}>
        <div className="relative">
          <img src={icon} alt={name} className="w-16 h-16 object-cover" />
          {badgeCount && badgeCount > 0 && (
            <div 
              className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
              style={{
                minWidth: '20px',
                height: '20px',
                fontSize: '10px',
                fontFamily: 'Minecraft',
                imageRendering: 'pixelated'
              }}
            >
              {badgeCount > 99 ? '99+' : badgeCount}
            </div>
          )}
        </div>
        <span className="text-white text-sm font-bold text-center leading-tight w-full" style={{ 
          fontFamily: 'monospace',
          wordWrap: 'break-word',
          fontSize: '13px'
        }}>
          {name}
        </span>
      </div>
    </div>
  );
}