'use client';

interface LegendItem {
  color?: string;
  icon?: React.ReactNode;
  label: string;
  description?: string;
}

interface LegendProps {
  title: string;
  items: LegendItem[];
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}

export default function Legend({ 
  title, 
  items, 
  position = 'bottom-right',
  className = ''
}: LegendProps) {
  const positionClasses = {
    'top-left': 'top-6 left-6',
    'top-right': 'top-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-right': 'bottom-6 right-6',
  };

  return (
    <div className={`absolute ${positionClasses[position]} bg-black bg-opacity-95 text-white p-4 border border-gray-600 z-20 shadow-lg ${className}`}>
      <h4 className="text-sm font-semibold mb-3 text-gray-200">{title}</h4>
      <div className="space-y-2 text-xs">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            {item.color && (
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
            )}
            {item.icon && (
              <div className="w-3 h-3 flex-shrink-0 flex items-center justify-center">
                {item.icon}
              </div>
            )}
            <div className="flex-1">
              <span className="text-gray-300">{item.label}</span>
              {item.description && (
                <div className="text-gray-400 text-xs mt-0.5">{item.description}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}