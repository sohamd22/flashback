'use client';

import { User } from '@/lib/auth';

interface AppHeaderProps {
  title?: string;
  user?: User;
  showBackButton?: boolean;
  onBack?: () => void;
  onLogout?: () => void;
  rightContent?: React.ReactNode;
  subtitle?: string;
}

export default function AppHeader({
  title = 'Flashback',
  user,
  showBackButton = false,
  onBack,
  onLogout,
  rightContent,
  subtitle
}: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between p-3 bg-gray-400 border-b-4 border-gray-800" style={{
      boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255,255,255,0.8)',
      fontFamily: 'monospace'
    }}>
      <div className="flex items-center gap-2">
        {showBackButton && onBack && (
          <button
            onClick={onBack}
            className="px-2 py-1 bg-gray-300 border-2 border-gray-600 text-black text-xs hover:bg-gray-200 transition-all font-bold"
            style={{
              boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)'
            }}
          >
            &lt; BACK
          </button>
        )}
        
        <div className="flex items-center gap-2">
          {user?.profilePhoto && (
            <div 
              className="w-8 h-8 border-2 border-gray-600 overflow-hidden"
              style={{
                boxShadow: 'inset 1px 1px 0px rgba(0,0,0,0.2)',
                imageRendering: 'pixelated'
              }}
            >
              <img
                src={user.profilePhoto}
                alt={user.name}
                className="w-full h-full object-cover"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          )}
          <div>
            <h1 className="text-sm font-bold text-black">{title}</h1>
            {subtitle && (
              <p className="text-xs text-gray-700">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {rightContent || (user && onLogout && (
        <button
          onClick={onLogout}
          className="px-2 py-1 bg-gray-300 border-2 border-gray-600 text-black text-xs hover:bg-gray-200 transition-all font-bold"
          style={{
            boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)'
          }}
        >
          LOGOUT
        </button>
      ))}
    </header>
  );
}