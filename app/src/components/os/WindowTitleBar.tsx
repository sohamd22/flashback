'use client';

interface WindowTitleBarProps {
  title: string;
  onMouseDown: (e: React.MouseEvent) => void;
  onClose: () => void;
}

export default function WindowTitleBar({
  title,
  onMouseDown,
  onClose
}: WindowTitleBarProps) {
  return (
    <div
      className="h-8 bg-gray-400 border-b-4 border-gray-800 flex items-center justify-between px-2 cursor-move"
      style={{
        boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.5), inset 1px 1px 0px rgba(255,255,255,0.8)'
      }}
      onMouseDown={onMouseDown}
    >
      <span className="text-sm font-bold text-black truncate flex-1" style={{ fontFamily: 'monospace' }}>
        {title}
      </span>
      <div className="window-controls flex gap-1">
        <button
          className="w-6 h-6 bg-gray-300 border-2 border-gray-600 hover:bg-gray-400 flex items-center justify-center text-xs font-bold"
          style={{
            boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)',
            fontFamily: 'monospace'
          }}
          onClick={onClose}
        >
          X
        </button>
      </div>
    </div>
  );
}