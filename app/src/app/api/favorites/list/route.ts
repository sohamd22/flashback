import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const MODAL_API_URL = 'https://jzflint--video-processing-api-fastapi-app.modal.run';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    // Get all favorites for the user
    const { data, error } = await supabase
      .from('favorite_clips')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        favorites: [],
        count: 0
      });
    }

    // Get fresh presigned URLs for each favorite clip from Modal API
    const refreshedFavorites = [];
    
    for (const favorite of data) {
      try {
        // Call Modal API to get fresh URL for this specific clip
        const response = await fetch(`${MODAL_API_URL}/retrieve-clips`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            query: favorite.query || 'video', // Use stored query or fallback
            top_k: 50
          }),
        });

        if (response.ok) {
          const clipData = await response.json();
          
          // Find the matching clip by chunk_id
          const matchingClip = clipData.clips?.find((clip: any) => 
            clip.chunk_id === favorite.chunk_id
          );

          if (matchingClip) {
            // Use fresh URL from Modal API
            refreshedFavorites.push({
              ...favorite,
              originalUrl: matchingClip.url,
              url: `/api/proxy/video?url=${encodeURIComponent(matchingClip.url)}`
            });
          } else {
            // Fallback to stored URL if clip not found
            refreshedFavorites.push({
              ...favorite,
              originalUrl: favorite.video_url,
              url: `/api/proxy/video?url=${encodeURIComponent(favorite.video_url)}`
            });
          }
        } else {
          // Fallback to stored URL if Modal API fails
          refreshedFavorites.push({
            ...favorite,
            originalUrl: favorite.video_url,
            url: `/api/proxy/video?url=${encodeURIComponent(favorite.video_url)}`
          });
        }
      } catch (modalError) {
        // Fallback to stored URL if Modal API call fails
        console.warn(`Failed to refresh URL for clip ${favorite.chunk_id}:`, modalError);
        refreshedFavorites.push({
          ...favorite,
          originalUrl: favorite.video_url,
          url: `/api/proxy/video?url=${encodeURIComponent(favorite.video_url)}`
        });
      }
    }

    return NextResponse.json({
      success: true,
      favorites: refreshedFavorites,
      count: refreshedFavorites.length
    });
  } catch (error) {
    console.error('Error listing favorites:', error);
    return NextResponse.json(
      { error: 'Failed to list favorites' },
      { status: 500 }
    );
  }
}