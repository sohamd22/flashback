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
  title = 'Photographic',
  user,
  showBackButton = false,
  onBack,
  onLogout,
  rightContent,
  subtitle
}: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between p-6 border-b border-gray-800">
      <div className="flex items-center gap-4">
        {showBackButton && onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Network
          </button>
        )}
        
        <div className="flex items-center gap-3">
          {user?.profilePhoto && (
            <img
              src={user.profilePhoto}
              alt={user.name}
              className="w-10 h-10 object-cover rounded-full border-2 border-gray-600"
            />
          )}
          <div>
            <h1 className="text-xl font-light">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {rightContent || (user && onLogout && (
        <button
          onClick={onLogout}
          className="px-4 py-2 text-sm text-gray-500 hover:text-white transition-colors duration-200"
        >
          Sign Out
        </button>
      ))}
    </header>
  );
}