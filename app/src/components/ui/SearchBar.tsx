'use client';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className = ''
}: SearchBarProps) {
  return (
    <div className={`relative max-w-md w-full ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-white border-2 border-gray-600 text-black placeholder-gray-600 focus:outline-none focus:border-gray-800 transition-all text-sm"
        style={{
          boxShadow: 'inset 2px 2px 0px rgba(0,0,0,0.2)',
          fontFamily: 'monospace'
        }}
      />
      <div 
        className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600 font-bold text-xs flex items-center justify-center"
        style={{ fontFamily: 'monospace' }}
      >
        🔍
      </div>
    </div>
  );
}