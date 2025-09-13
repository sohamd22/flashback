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
    <div 
      className={`absolute ${positionClasses[position]} bg-gray-300 border-4 border-gray-800 text-black p-3 z-20 ${className}`}
      style={{
        boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255,255,255,0.8), 4px 4px 0px rgba(0,0,0,0.3)',
        fontFamily: 'monospace',
        fontSize: '11px'
      }}
    >
      <h4 className="text-xs font-bold mb-2 text-black">{title}</h4>
      <div className="space-y-1">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {item.color && (
              <div 
                className="w-3 h-3 border border-gray-600 flex-shrink-0"
                style={{ 
                  backgroundColor: item.color,
                  boxShadow: 'inset 1px 1px 0px rgba(0,0,0,0.2)'
                }}
              />
            )}
            {item.icon && (
              <div className="w-3 h-3 flex-shrink-0 flex items-center justify-center">
                {item.icon}
              </div>
            )}
            <div className="flex-1">
              <span className="text-black font-bold">{item.label}</span>
              {item.description && (
                <div className="text-gray-700 text-xs">{item.description}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}