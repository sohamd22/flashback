export interface GraphNode {
  id: string;
  name: string;
  photo: string;
  x: number;
  y: number;
  isUser?: boolean;
  email?: string;
}

export interface GraphConnection {
  fromId: string;
  toId: string;
  interactions: number;
  strength: number; // 0-1, calculated from interactions
}

export interface APIUser {
  id: number;
  name: string;
  email: string;
  profile_photo: string;
  reference_image: string | null;
  video_ids: number[];
}

export interface APIInteraction {
  id: number;
  interaction_count: number;
  created_at: string;
  updated_at: string;
  user1: APIUser;
  user2: APIUser;
}

export interface GraphData {
  nodes: GraphNode[];
  connections: GraphConnection[];
}

// Multi-dimensional scaling algorithm for 2D projection
export const performMDS = (distanceMatrix: number[][], width: number, height: number): { x: number; y: number }[] => {
  const n = distanceMatrix.length;
  if (n === 0) return [];
  
  // Simple force-directed layout approach (easier than full MDS)
  const positions = Array(n).fill(0).map(() => ({
    x: Math.random() * width,
    y: Math.random() * height
  }));
  
  // Iterative force-based positioning
  for (let iter = 0; iter < 200; iter++) {
    const forces = positions.map(() => ({ x: 0, y: 0 }));
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const targetDistance = distanceMatrix[i][j] * 200; // Scale factor
        
        const force = (distance - targetDistance) * 0.01;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        forces[i].x += fx;
        forces[i].y += fy;
        forces[j].x -= fx;
        forces[j].y -= fy;
      }
    }
    
    // Apply forces and keep within bounds
    for (let i = 0; i < n; i++) {
      positions[i].x = Math.max(80, Math.min(width - 80, positions[i].x - forces[i].x));
      positions[i].y = Math.max(80, Math.min(height - 80, positions[i].y - forces[i].y));
    }
  }
  
  return positions;
};

// Convert API interactions to graph data with MDS positioning
export const convertAPIDataToGraphData = (
  interactions: APIInteraction[], 
  currentUserId: number, 
  width: number, 
  height: number
): GraphData => {
  // Extract all unique users
  const userMap = new Map<number, APIUser>();
  interactions.forEach(interaction => {
    userMap.set(interaction.user1.id, interaction.user1);
    userMap.set(interaction.user2.id, interaction.user2);
  });
  
  const users = Array.from(userMap.values());
  const userIds = users.map(u => u.id);
  const n = users.length;
  
  if (n === 0) {
    return { nodes: [], connections: [] };
  }
  
  // Create distance matrix (inverse of interactions)
  const distanceMatrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  
  // Initialize with high distance (low interaction)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        distanceMatrix[i][j] = 0;
      } else {
        distanceMatrix[i][j] = 5; // High distance for no interaction
      }
    }
  }
  
  // Fill in actual interactions
  interactions.forEach(interaction => {
    const idx1 = userIds.indexOf(interaction.user1.id);
    const idx2 = userIds.indexOf(interaction.user2.id);
    
    if (idx1 !== -1 && idx2 !== -1) {
      const interactionCount = interaction.interaction_count;
      // Distance inversely proportional to interactions
      const distance = Math.max(0.1, 1 / (interactionCount + 1));
      distanceMatrix[idx1][idx2] = distance;
      distanceMatrix[idx2][idx1] = distance;
    }
  });
  
  // Perform MDS to get 2D positions
  const positions = performMDS(distanceMatrix, width, height);
  
  // Create nodes
  const nodes: GraphNode[] = users.map((user, index) => ({
    id: user.id.toString(),
    name: user.name,
    photo: `data:image/jpeg;base64,${user.profile_photo}`,
    email: user.email,
    x: positions[index]?.x || width / 2,
    y: positions[index]?.y || height / 2,
    isUser: user.id === currentUserId
  }));
  
  // Create connections for all pairs with interactions > 0
  const connections: GraphConnection[] = [];
  const maxInteractions = Math.max(...interactions.map(i => i.interaction_count), 1);
  
  interactions.forEach(interaction => {
    const strength = interaction.interaction_count / maxInteractions;
    connections.push({
      fromId: interaction.user1.id.toString(),
      toId: interaction.user2.id.toString(),
      interactions: interaction.interaction_count,
      strength
    });
  });
  
  return { nodes, connections };
};

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