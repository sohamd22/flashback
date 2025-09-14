'use client';

interface FriendNodeProps {
  x: number;
  y: number;
  photo: string;
  name: string;
  userId?: string;
  size?: number;
  isHovered?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  onProfileClick?: (userId: string, userName: string, userPhoto: string) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export default function FriendNode({
  x,
  y,
  photo,
  name,
  userId,
  size = 120,
  isHovered = false,
  isDragging = false,
  onClick,
  onProfileClick,
  onMouseEnter,
  onMouseLeave,
  onMouseDown
}: FriendNodeProps) {
  const nodeSize = size;
  
  return (
    <div
      style={{
        position: 'absolute',
        left: x - nodeSize/2,
        top: y - nodeSize/2,
        width: nodeSize,
        height: nodeSize,
        zIndex: isDragging ? 20 : (isHovered ? 10 : 5),
        transform: isDragging ? 'scale(1.1)' : isHovered ? 'scale(1.05)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      className={`select-none ${isDragging ? 'cursor-grabbing' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick();
        if (onProfileClick && userId) {
          onProfileClick(userId, name, photo);
        }
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
    >
      <div 
        className="relative w-full h-full bg-white border-4 border-gray-600 flex items-center justify-center"
        style={{
          imageRendering: 'pixelated',
          boxShadow: 'inset -3px -3px 0px rgba(0,0,0,0.3), inset 3px 3px 0px rgba(255,255,255,1), 6px 6px 0px rgba(0,0,0,0.2)',
          background: 'linear-gradient(135deg, #dcfce7, #22c55e)'
        }}
      >
        {/* User photo */}
        <img
          src={photo}
          alt={name}
          className="w-full h-full object-cover select-none pointer-events-none"
          style={{ 
            padding: '8px',
            imageRendering: 'pixelated'
          }}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
      </div>
      
      {isHovered && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 transition-all duration-200">
          <div 
            className="bg-white border-4 border-gray-600 text-gray-800 px-3 py-1 text-xs font-bold whitespace-nowrap"
            style={{
              fontFamily: 'monospace',
              imageRendering: 'pixelated',
              boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,1), 4px 4px 0px rgba(0,0,0,0.2)'
            }}
          >
            {name}
          </div>
        </div>
      )}
    </div>
  );
}