export interface SharedMemory {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  date: string;
  uploader: 'user' | 'friend'; // Who uploaded this memory
  tags: string[];
  location?: string;
  x?: number;
  y?: number;
}

export interface FriendProfile {
  id: string;
  name: string;
  photo: string;
  isFriend: boolean;
  mutualMemories: number;
}

export interface SharedMemoryResult {
  friend: FriendProfile;
  userMemories: SharedMemory[]; // Memories uploaded by the current user
  friendMemories: SharedMemory[]; // Memories uploaded by the friend (only if they're friends)
  allMemories: SharedMemory[]; // Combined for positioning
}

// Generate mock shared memories based on friendship status
export const generateSharedMemories = (
  friend: FriendProfile,
  canvasWidth: number,
  canvasHeight: number
): SharedMemoryResult => {
  // Memories uploaded by the current user that include this friend
  const userMemories: SharedMemory[] = [
    {
      id: 'user-1',
      title: `Hiking with ${friend.name}`,
      description: 'Great trail adventure together',
      thumbnail: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=200&h=150&fit=crop',
      duration: 120,
      date: '2024-06-10',
      uploader: 'user',
      tags: ['hiking', 'adventure', 'mountains'],
      location: 'Yosemite National Park'
    },
    {
      id: 'user-2',
      title: `Coffee date`,
      description: `Morning coffee with ${friend.name}`,
      thumbnail: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=200&h=150&fit=crop',
      duration: 45,
      date: '2024-08-15',
      uploader: 'user',
      tags: ['coffee', 'morning', 'casual'],
      location: 'Blue Bottle Coffee'
    },
    {
      id: 'user-3',
      title: `Dinner party`,
      description: `Hosted dinner with ${friend.name} and others`,
      thumbnail: 'https://images.unsplash.com/photo-1544148103-0773bf10d330?w=200&h=150&fit=crop',
      duration: 90,
      date: '2024-07-22',
      uploader: 'user',
      tags: ['dinner', 'party', 'hosting'],
      location: 'Home'
    }
  ];

  // Friend's memories (only visible if they're friends)
  const friendMemories: SharedMemory[] = friend.isFriend ? [
    {
      id: 'friend-1',
      title: `Beach day`,
      description: `${friend.name}'s perspective of our beach trip`,
      thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&h=150&fit=crop',
      duration: 75,
      date: '2024-08-20',
      uploader: 'friend',
      tags: ['beach', 'sunset', 'relaxing'],
      location: 'Santa Monica Beach'
    },
    {
      id: 'friend-2',
      title: `Concert night`,
      description: `${friend.name} recorded our concert experience`,
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=150&fit=crop',
      duration: 60,
      date: '2024-09-01',
      uploader: 'friend',
      tags: ['concert', 'music', 'nightlife'],
      location: 'The Fillmore'
    }
  ] : [];

  const allMemories = [...userMemories, ...friendMemories];

  // Position memories in the canvas
  const centerY = canvasHeight / 2;
  const userX = canvasWidth * 0.25; // Left side for user memories
  const friendX = canvasWidth * 0.75; // Right side for friend memories
  
  // Position user memories on the left side
  const positionedUserMemories = userMemories.map((memory, index) => {
    const angle = (index / Math.max(userMemories.length - 1, 1)) * Math.PI - Math.PI/2; // Vertical spread
    const radius = 150;
    
    return {
      ...memory,
      x: userX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };
  });

  // Position friend memories on the right side
  const positionedFriendMemories = friendMemories.map((memory, index) => {
    const angle = (index / Math.max(friendMemories.length - 1, 1)) * Math.PI - Math.PI/2; // Vertical spread
    const radius = 150;
    
    return {
      ...memory,
      x: friendX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };
  });

  const positionedAllMemories = [...positionedUserMemories, ...positionedFriendMemories];

  return {
    friend,
    userMemories: positionedUserMemories,
    friendMemories: positionedFriendMemories,
    allMemories: positionedAllMemories
  };
};