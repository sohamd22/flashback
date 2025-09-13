'use client';

interface VideoNodeProps {
  id: string;
  x: number;
  y: number;
  thumbnail: string;
  title: string;
  duration: number;
  size?: number;
  similarity?: number;
  uploader?: 'user' | 'friend';
  isHovered?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function VideoNode({
  x,
  y,
  thumbnail,
  title,
  duration,
  size = 70,
  similarity,
  uploader = 'user',
  isHovered = false,
  onClick,
  onMouseEnter,
  onMouseLeave
}: VideoNodeProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size/2,
        top: y - size/2,
        width: size,
        height: size,
        zIndex: isHovered ? 10 : 2,
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
        transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      className="cursor-pointer select-none"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="relative w-full h-full border-2 border-gray-600 rounded-full overflow-hidden shadow-lg">
        <img
          src={thumbnail}
          alt={title}
          className="w-full h-full object-cover"
          draggable={false}
        />
        
        {/* Duration overlay */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 font-mono rounded">
          {formatDuration(duration)}
        </div>
        
        {/* Similarity indicator for search mode */}
        {similarity !== undefined && (
          <div 
            className="absolute top-2 left-1/2 transform -translate-x-1/2 w-2 h-2 rounded-full"
            style={{ 
              backgroundColor: `hsl(${similarity * 120}, 70%, 50%)`,
              opacity: 0.8
            }}
          />
        )}
        
        {/* Uploader indicator for shared memories */}
        {uploader && (
          <div className={`absolute top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 rounded-full ${
            uploader === 'user' ? 'bg-blue-400' : 'bg-green-400'
          }`} />
        )}
      </div>
      
      {/* Title on hover */}
      {isHovered && (
        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 transition-all duration-200">
          <div className="bg-black bg-opacity-90 text-white px-2 py-1 text-xs font-medium whitespace-nowrap border border-gray-600 max-w-32 truncate">
            {title}
          </div>
        </div>
      )}
    </div>
  );
}
