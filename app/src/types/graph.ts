export interface GraphNode {
  id: string;
  name: string;
  photo: string;
  x: number;
  y: number;
  isUser?: boolean;
  isFriend?: boolean;
}

export interface GraphConnection {
  fromId: string;
  toId: string;
  mutualMemories: number;
  strength: number; // 0-1, calculated from mutual memories
}

export interface GraphData {
  nodes: GraphNode[];
  connections: GraphConnection[];
}

// Mock data generator
export const generateMockGraphData = (userPhoto: string, userName: string, canvasWidth: number = 800, canvasHeight: number = 600): GraphData => {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  
  // User node at center
  const userNode: GraphNode = {
    id: 'user',
    name: userName,
    photo: userPhoto,
    x: centerX,
    y: centerY,
    isUser: true
  };

  // Generate other people nodes with Unsplash photos
  const peopleData = [
    {
      id: '1',
      name: 'Sarah Chen',
      photo: 'https://images.unsplash.com/photo-1494790108755-2616b612b562?w=150&h=150&fit=crop&crop=face',
      memories: Math.floor(Math.random() * 20) + 5, // 5-24 memories
      isFriend: true
    },
    {
      id: '2', 
      name: 'Marcus Johnson',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      memories: Math.floor(Math.random() * 15) + 2, // 2-16 memories
      isFriend: true
    },
    {
      id: '3',
      name: 'Elena Rodriguez',
      photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      memories: Math.floor(Math.random() * 25) + 1, // 1-25 memories
      isFriend: false
    },
    {
      id: '4',
      name: 'David Kim',
      photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      memories: Math.floor(Math.random() * 18) + 3, // 3-20 memories
      isFriend: true
    },
    {
      id: '5',
      name: 'Priya Patel',
      photo: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150&h=150&fit=crop&crop=face',
      memories: Math.floor(Math.random() * 12) + 1, // 1-12 memories
      isFriend: false
    },
    {
      id: '6',
      name: 'Alex Thompson',
      photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
      memories: Math.floor(Math.random() * 22) + 4, // 4-25 memories
      isFriend: true
    },
    {
      id: '7',
      name: 'Maya Singh',
      photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
      memories: Math.floor(Math.random() * 8) + 1, // 1-8 memories
      isFriend: false
    },
    {
      id: '8',
      name: 'Jordan Lee',
      photo: 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face',
      memories: Math.floor(Math.random() * 16) + 2, // 2-17 memories
      isFriend: true
    }
  ];

  // Calculate positions based on inverse relationship to memories
  const otherNodes: GraphNode[] = peopleData.map((person, index) => {
    const angle = (index / peopleData.length) * 2 * Math.PI;
    
    // Distance inversely proportional to memories
    // More memories = closer to center, fewer memories = farther away
    const maxMemories = 25;
    const minDistance = 120; // Minimum distance from center
    const maxDistance = Math.min(canvasWidth, canvasHeight) * 0.35; // Maximum distance
    
    // Inverse relationship: fewer memories = greater distance
    const normalizedMemories = person.memories / maxMemories;
    const distance = minDistance + (maxDistance - minDistance) * (1 - normalizedMemories);
    
    return {
      id: person.id,
      name: person.name,
      photo: person.photo,
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance,
      isFriend: person.isFriend
    };
  });

  // Generate connections only between user and other people (no friend-to-friend connections)
  const connections: GraphConnection[] = peopleData.map((person, index) => {
    const mutualMemories = person.memories;
    const maxMemories = 25;
    const strength = mutualMemories / maxMemories;
    
    return {
      fromId: 'user',
      toId: person.id,
      mutualMemories,
      strength
    };
  });

  return {
    nodes: [userNode, ...otherNodes],
    connections
  };
};