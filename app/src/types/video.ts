export interface VideoClip {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number; // in seconds
  date: string;
  tags: string[];
  location?: string;
  people?: string[];
  x?: number; // position for graph layout
  y?: number;
  similarity?: number; // 0-1, similarity to search query
}

export interface VideoSearchResult {
  videos: VideoClip[];
  query: string;
  centerX: number;
  centerY: number;
}

// Calculate similarity between search query and video using simple keyword matching
export const calculateSimilarity = (query: string, video: VideoClip): number => {
  if (!query.trim()) return 0.5; // Default similarity when no search
  
  const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
  if (queryWords.length === 0) return 0.5;
  
  const searchableText = [
    video.title,
    video.description,
    ...(video.tags || []),
    video.location || '',
    ...(video.people || [])
  ].join(' ').toLowerCase();
  
  let matchCount = 0;
  let totalWeight = 0;
  
  queryWords.forEach(word => {
    totalWeight += 1;
    if (searchableText.includes(word)) {
      matchCount += 1;
    }
    // Partial matches
    const partialMatches = searchableText.split(' ').filter(textWord => 
      textWord.includes(word) || word.includes(textWord)
    );
    matchCount += partialMatches.length * 0.3;
  });
  
  return Math.min(matchCount / Math.max(totalWeight, 1), 1);
};

// Generate mock video data
export const generateMockVideos = (): VideoClip[] => {
  return [
    {
      id: '1',
      title: 'Beach sunset with Sarah',
      description: 'Beautiful golden hour at Santa Monica beach',
      thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&h=150&fit=crop',
      duration: 45,
      date: '2024-08-15',
      tags: ['sunset', 'beach', 'golden hour', 'peaceful'],
      location: 'Santa Monica Beach',
      people: ['Sarah Chen']
    },
    {
      id: '2', 
      title: 'Birthday party celebration',
      description: 'Surprise party for Marcus with friends',
      thumbnail: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=200&h=150&fit=crop',
      duration: 120,
      date: '2024-07-22',
      tags: ['birthday', 'party', 'celebration', 'friends', 'surprise'],
      location: 'Home',
      people: ['Marcus Johnson', 'Elena Rodriguez', 'Priya Patel']
    },
    {
      id: '3',
      title: 'Mountain hiking adventure',
      description: 'Epic hike through Yosemite trails',
      thumbnail: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=200&h=150&fit=crop',
      duration: 180,
      date: '2024-06-10',
      tags: ['hiking', 'mountains', 'adventure', 'nature', 'trails'],
      location: 'Yosemite National Park',
      people: ['David Kim', 'Alex Thompson']
    },
    {
      id: '4',
      title: 'Coffee shop morning',
      description: 'Quiet morning at the local café',
      thumbnail: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=200&h=150&fit=crop',
      duration: 30,
      date: '2024-09-01',
      tags: ['coffee', 'morning', 'café', 'quiet', 'peaceful'],
      location: 'Blue Bottle Coffee',
      people: []
    },
    {
      id: '5',
      title: 'Concert night with friends',
      description: 'Amazing indie rock concert downtown',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=150&fit=crop',
      duration: 90,
      date: '2024-05-18',
      tags: ['concert', 'music', 'indie rock', 'nightlife', 'live music'],
      location: 'The Fillmore',
      people: ['Maya Singh', 'Jordan Lee']
    },
    {
      id: '6',
      title: 'Cooking dinner together',
      description: 'Making pasta from scratch with Priya',
      thumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=150&fit=crop',
      duration: 60,
      date: '2024-08-03',
      tags: ['cooking', 'dinner', 'pasta', 'homemade', 'kitchen'],
      location: 'Home Kitchen',
      people: ['Priya Patel']
    },
    {
      id: '7',
      title: 'City skyline at night',
      description: 'Stunning views from the rooftop',
      thumbnail: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1f?w=200&h=150&fit=crop',
      duration: 25,
      date: '2024-07-01',
      tags: ['city', 'skyline', 'night', 'lights', 'rooftop', 'urban'],
      location: 'Downtown Rooftop',
      people: []
    },
    {
      id: '8',
      title: 'Dog park afternoon',
      description: 'Playing with dogs at the local park',
      thumbnail: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=200&h=150&fit=crop',
      duration: 40,
      date: '2024-08-28',
      tags: ['dogs', 'park', 'afternoon', 'playing', 'animals', 'outdoor'],
      location: 'Central Park',
      people: ['Elena Rodriguez']
    },
    {
      id: '9',
      title: 'Art museum visit',
      description: 'Exploring modern art exhibitions',
      thumbnail: 'https://images.unsplash.com/photo-1544967882-4d2b1d9b05b8?w=200&h=150&fit=crop',
      duration: 75,
      date: '2024-06-25',
      tags: ['art', 'museum', 'culture', 'exhibitions', 'modern art'],
      location: 'MOMA',
      people: ['Sarah Chen', 'David Kim']
    },
    {
      id: '10',
      title: 'Weekend farmers market',
      description: 'Fresh produce and local vendors',
      thumbnail: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=200&h=150&fit=crop',
      duration: 50,
      date: '2024-09-07',
      tags: ['farmers market', 'fresh produce', 'local', 'weekend', 'healthy'],
      location: 'Union Square Market',
      people: ['Alex Thompson']
    }
  ];
};

// Position videos in a galaxy/graph layout based on search state
export const positionVideosForSearch = (
  videos: VideoClip[], 
  query: string, 
  canvasWidth: number, 
  canvasHeight: number,
  minThreshold: number = 0.1
): VideoSearchResult => {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  
  // Calculate similarity scores
  const videosWithSimilarity = videos.map(video => ({
    ...video,
    similarity: calculateSimilarity(query, video)
  }));
  
  // If no search query, create floating star galaxy pattern
  if (!query.trim()) {
    const maxRadius = Math.min(canvasWidth, canvasHeight) * 0.45;
    const minRadius = 100;
    
    return {
      videos: videos.map((video, index) => {
        // Create multiple orbital rings with different densities
        const ringIndex = index % 3; // 3 rings
        const ringRadius = minRadius + (ringIndex / 2) * (maxRadius - minRadius);
        const angleOffset = ringIndex * 0.7; // Offset rings for organic feel
        
        // Random angle with slight clustering for organic distribution
        const baseAngle = (index / videos.length) * 2 * Math.PI;
        const randomOffset = (Math.random() - 0.5) * 0.8; // Add some randomness
        const angle = baseAngle + angleOffset + randomOffset;
        
        // Slight radius variation for organic feel
        const radiusVariation = (Math.random() - 0.5) * 60;
        const finalRadius = ringRadius + radiusVariation;
        
        return {
          ...video,
          x: centerX + Math.cos(angle) * finalRadius,
          y: centerY + Math.sin(angle) * finalRadius,
          similarity: 0.5
        };
      }),
      query,
      centerX,
      centerY
    };
  }
  
  // Filter by minimum threshold for search results
  const relevantVideos = videosWithSimilarity.filter(v => v.similarity >= minThreshold);
  
  // Position based on similarity - closer = more similar (graph mode)
  const maxDistance = Math.min(canvasWidth, canvasHeight) * 0.4;
  const minDistance = 80;
  
  const positionedVideos = relevantVideos.map((video, index) => {
    const angle = (index / relevantVideos.length) * 2 * Math.PI;
    // Distance inversely proportional to similarity: higher similarity = closer to center
    const distance = maxDistance - ((video.similarity - minThreshold) / (1 - minThreshold)) * (maxDistance - minDistance);
    
    return {
      ...video,
      x: centerX + Math.cos(angle) * Math.max(minDistance, distance),
      y: centerY + Math.sin(angle) * Math.max(minDistance, distance)
    };
  });
  
  return {
    videos: positionedVideos,
    query,
    centerX,
    centerY
  };
};