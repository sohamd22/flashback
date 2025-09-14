'use client';

interface Window {
  id: string;
  title: string;
  icon: string;
  minimized: boolean;
}

interface TaskbarProps {
  windows: Window[];
  currentTime: Date;
  onWindowClick: (id: string) => void;
  onLogout?: () => void;
}

export default function Taskbar({ windows, currentTime, onWindowClick, onLogout }: TaskbarProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-12 bg-neutral-400 border-t-4 border-neutral-500 flex items-center justify-between z-50" style={{
      boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255, 255, 255, 0.3)'
    }}>
      {/* Start Menu */}
      <div className="flex items-center">
        <button 
          className="px-1 py-1 bg-gray-300 border-2 border-gray-600 hover:bg-gray-200 transition-all flex items-center justify-center"
          style={{
            boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)',
            width: '32px',
            height: '32px',
            borderRight: '1px solid #666'
          }}
          title="START"
        >
          <img 
            src="/icons/photo_logo.png" 
            alt="START"
            className="w-6 h-6 object-cover"
            style={{ imageRendering: 'pixelated' }}
          />
        </button>
        {onLogout && (
          <button
            onClick={onLogout}
            className="px-1 py-1 bg-gray-300 border-2 border-gray-600 hover:bg-gray-200 transition-all flex items-center justify-center"
            style={{
              boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)',
              height: '32px',
              borderRight: '1px solid #666'
            }}
            title="SHUT DOWN"
          >
            <div className="w-fit h-6 flex items-center justify-center" style={{ imageRendering: 'pixelated' }}>
              <span className="text-lg text-gray-600"><img src="/icons/logout.png" alt="User" className="w-8 h-8 object-cover inline-block" /> </span>
            </div>
          </button>
        )}
      </div>

      {/* Running Apps */}
      <div className="flex flex-1">
        {windows.filter(w => !w.minimized).map((window, index) => (
          <button
            key={window.id}
            className="px-1 py-1 bg-gray-300 border-2 border-gray-600 hover:bg-gray-200 transition-all flex items-center justify-center"
            style={{
              boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)',
              width: '32px',
              height: '32px',
              borderRight: index < windows.filter(w => !w.minimized).length - 1 ? '1px solid #666' : '2px solid #666'
            }}
            onClick={() => onWindowClick(window.id)}
            title={window.title}
          >
            <img 
              src={window.icon} 
              alt={window.title}
              className="w-6 h-6 object-cover"
              style={{ imageRendering: 'pixelated' }}
            />
          </button>
        ))}
      </div>

      {/* System Tray */}
      <div className="flex items-center">
        <div className="bg-gray-300 border-2 border-gray-600 px-2 py-1 text-black text-xs font-bold" style={{
          boxShadow: 'inset 2px 2px 0px rgba(0,0,0,0.2)',
          fontFamily: 'monospace',
          borderLeft: '1px solid #666'
        }}>
          {new Date().toLocaleDateString()} {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}