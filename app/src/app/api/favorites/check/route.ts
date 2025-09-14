import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { userId, chunkIds } = await request.json();

    if (!userId || !chunkIds || !Array.isArray(chunkIds)) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and chunkIds (array)' },
        { status: 400 }
      );
    }

    if (chunkIds.length === 0) {
      return NextResponse.json({
        success: true,
        favorites: {}
      });
    }

    // Check which chunks are favorited
    const { data, error } = await supabase
      .from('favorite_clips')
      .select('chunk_id')
      .eq('user_id', userId)
      .in('chunk_id', chunkIds);

    if (error) {
      throw error;
    }

    // Create a map of chunk_id to favorite status
    const favoritesMap: { [key: string]: boolean } = {};
    chunkIds.forEach(chunkId => {
      favoritesMap[chunkId] = false;
    });

    if (data) {
      data.forEach(favorite => {
        favoritesMap[favorite.chunk_id] = true;
      });
    }

    return NextResponse.json({
      success: true,
      favorites: favoritesMap
    });
  } catch (error) {
    console.error('Error checking favorites:', error);
    return NextResponse.json(
      { error: 'Failed to check favorites' },
      { status: 500 }
    );
  }
}