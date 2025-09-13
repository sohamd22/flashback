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
      <div 
        className="relative w-full h-full border-4 border-gray-600 overflow-hidden"
        style={{
          boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255,255,255,0.8), 4px 4px 0px rgba(0,0,0,0.3)',
          imageRendering: 'pixelated'
        }}
      >
        <img
          src={thumbnail}
          alt={title}
          className="w-full h-full object-cover"
          style={{ imageRendering: 'pixelated' }}
          draggable={false}
        />
        
        {/* Duration overlay */}
        <div 
          className="absolute bottom-1 left-1/2 transform -translate-x-1/2 bg-gray-300 border-2 border-gray-600 text-black text-xs px-1 py-0.5 font-bold"
          style={{
            boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)',
            fontFamily: 'monospace',
            fontSize: '10px'
          }}
        >
          {formatDuration(duration)}
        </div>
        
        {/* Similarity indicator for search mode */}
        {similarity !== undefined && (
          <div 
            className="absolute top-1 right-1 w-3 h-3 border border-gray-800"
            style={{ 
              backgroundColor: `hsl(${similarity * 120}, 70%, 50%)`,
              boxShadow: 'inset 1px 1px 0px rgba(0,0,0,0.2)'
            }}
          />
        )}
        
        {/* Uploader indicator for shared memories */}
        {uploader && (
          <div className={`absolute top-1 left-1 w-3 h-3 border border-gray-800 ${
            uploader === 'user' ? 'bg-blue-400' : 'bg-green-400'
          }`} style={{
            boxShadow: 'inset 1px 1px 0px rgba(0,0,0,0.2)'
          }} />
        )}
      </div>
      
      {/* Title on hover */}
      {isHovered && (
        <div className="absolute -bottom-14 left-1/2 transform -translate-x-1/2 transition-all duration-200">
          <div 
            className="bg-gray-300 border-4 border-gray-800 text-black px-2 py-1 text-xs font-bold whitespace-nowrap max-w-32 truncate"
            style={{
              boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255,255,255,0.8), 4px 4px 0px rgba(0,0,0,0.3)',
              fontFamily: 'monospace'
            }}
          >
            {title.toUpperCase()}
          </div>
        </div>
      )}
    </div>
  );
}
