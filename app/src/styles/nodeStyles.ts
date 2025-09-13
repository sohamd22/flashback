// Shared styling utilities for consistent node appearance and behavior

export const nodeColors = {
  user: {
    border: 'border-white',
    ring: 'ring-white',
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    connection: 'rgba(59, 130, 246, 0.6)', // blue
  },
  friend: {
    border: 'border-gray-600',
    ring: 'ring-gray-500',
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    connection: 'rgba(34, 197, 94, 0.6)', // green
  },
  video: {
    border: 'border-gray-600',
    ring: 'ring-gray-400',
    bg: 'bg-gray-500/20',
    text: 'text-gray-300',
    connection: 'rgba(156, 163, 175, 0.4)', // gray
  }
} as const;

export const nodeSizes = {
  user: {
    main: 100,
    personal: 100,
    userDetail: 80,
  },
  friend: {
    main: 70,
    userDetail: 80,
  },
  video: {
    personal: 70,
    search: 60, // base size for search results
    searchMax: 100, // max size for high similarity
  }
} as const;

export const nodeAnimations = {
  hover: {
    scale: 'scale(1.05)',
    transition: 'transition-all duration-200',
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  drag: {
    scale: 'scale(1.1)',
    transition: 'transition-none',
  },
  elastic: {
    duration: 600,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  position: {
    transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
  }
} as const;

export const connectionStyles = {
  thickness: {
    min: 1,
    max: 4,
  },
  opacity: {
    min: 0.2,
    max: 0.7,
  },
  animation: {
    fade: 'transition-opacity 0.4s ease-in-out',
  }
} as const;

export const backgroundPatterns = {
  grid: {
    image: `
      linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
    `,
    size: '40px 40px',
    opacity: 'opacity-10',
  },
  dots: {
    image: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
    size: '20px 20px',
    opacity: 'opacity-5',
  }
} as const;