'use client';

interface FriendNodeProps {
  x: number;
  y: number;
  photo: string;
  name: string;
  size?: number;
  isHovered?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export default function FriendNode({
  x,
  y,
  photo,
  name,
  size = 120,
  isHovered = false,
  isDragging = false,
  onClick,
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
        zIndex: isDragging ? 10 : (isHovered ? 5 : 2),
        transform: isDragging ? 'scale(1.1)' : isHovered ? 'scale(1.05)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      className={`select-none ${isDragging ? 'cursor-grabbing' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
    >
      <div 
        className="relative w-full h-full"
        style={{
          imageRendering: 'pixelated',
          filter: 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.5)) drop-shadow(0 0 12px rgba(34, 197, 94, 0.3))'
        }}
      >
        {/* Border-green.png as background */}
        <img
          src="/icons/border-green.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          style={{ imageRendering: 'pixelated' }}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
        
        {/* User photo as circular overlay, smaller */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={photo}
            alt={name}
            className="select-none pointer-events-none"
            style={{ 
              width: `${nodeSize * 0.5}px`,
              height: `${nodeSize * 0.5}px`,
              borderRadius: '50%',
              margin: '4.5px 0 0 3.5px',
              objectFit: 'cover',
              imageRendering: 'pixelated',
              border: '2px solid rgba(0,0,0,0.3)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.2), 0 0 0 2px rgba(0,0,0,0.1)'
            }}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          />
        </div>
      </div>
      
      {isHovered && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 transition-all duration-200 opacity-100 translate-y-0">
          <div 
            className="bg-gray-300 border-4 border-gray-800 text-black px-2 py-1 text-xs font-bold whitespace-nowrap"
            style={{
              boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255,255,255,0.8), 4px 4px 0px rgba(0,0,0,0.3)',
              fontFamily: 'monospace'
            }}
          >
            {name.toUpperCase()}
          </div>
        </div>
      )}
    </div>
  );
}