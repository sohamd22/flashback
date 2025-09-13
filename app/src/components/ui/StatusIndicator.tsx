'use client';

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'friend' | 'not-friend' | 'active';
  text?: string;
  showDot?: boolean;
  className?: string;
}

export default function StatusIndicator({
  status,
  text,
  showDot = true,
  className = ''
}: StatusIndicatorProps) {
  const statusConfig = {
    online: { color: 'bg-green-500', text: 'Online' },
    offline: { color: 'bg-gray-500', text: 'Offline' },
    friend: { color: 'bg-green-500', text: 'Friends' },
    'not-friend': { color: 'bg-gray-500', text: 'Not friends' },
    active: { color: 'bg-blue-500', text: 'Active' },
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
      {showDot && (
        <div className={`w-2 h-2 ${config.color} rounded-full`} />
      )}
      <span>{text || config.text}</span>
    </div>
  );
}