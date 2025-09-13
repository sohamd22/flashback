'use client';

interface NodeImageProps {
  src: string;
  alt: string;
  borderColor?: string;
  borderWidth?: number;
  shadow?: string;
  glowOnHover?: boolean;
  className?: string;
}

export default function NodeImage({
  src,
  alt,
  borderColor = 'border-gray-600',
  borderWidth = 2,
  shadow = 'shadow-lg',
  glowOnHover = false,
  className = ''
}: NodeImageProps) {
  const glowClass = glowOnHover ? 'shadow-white/20' : '';
  
  return (
    <div className={`relative w-full h-full rounded-full overflow-hidden ${shadow} border-${borderWidth} ${borderColor} ${glowClass} ${className}`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover select-none pointer-events-none"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
}