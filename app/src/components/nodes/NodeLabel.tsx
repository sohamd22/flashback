'use client';

interface NodeLabelProps {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  color?: string;
  borderColor?: string;
  size?: 'xs' | 'sm' | 'md';
  maxWidth?: string;
}

export default function NodeLabel({
  text,
  position = 'bottom',
  color = 'bg-black bg-opacity-90',
  borderColor = 'border-gray-600',
  size = 'xs',
  maxWidth = 'max-w-32'
}: NodeLabelProps) {
  const positionClasses = {
    top: '-top-12',
    bottom: '-bottom-12',
    left: '-left-12',
    right: '-right-12'
  };

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base'
  };

  return (
    <div className={`absolute ${positionClasses[position]} left-1/2 transform -translate-x-1/2 transition-all duration-200`}>
      <div className={`${color} text-white px-2 py-1 ${sizeClasses[size]} font-medium whitespace-nowrap border ${borderColor} ${maxWidth} truncate`}>
        {text}
      </div>
    </div>
  );
}