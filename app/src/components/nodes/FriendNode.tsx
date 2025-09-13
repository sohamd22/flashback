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
  size = 70,
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
      <div className="relative w-full h-full rounded-full overflow-hidden shadow-xl border-2 border-gray-600">
        <img
          src={photo}
          alt={name}
          className="w-full h-full object-cover select-none pointer-events-none"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
      </div>
      
      {isHovered && (
        <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 transition-all duration-200 opacity-100 translate-y-0">
          <div className="bg-black bg-opacity-90 text-white px-2 py-1 text-sm font-medium whitespace-nowrap border border-gray-600">
            {name}
          </div>
        </div>
      )}
    </div>
  );
}