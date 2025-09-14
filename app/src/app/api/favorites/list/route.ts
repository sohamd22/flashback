import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // Transform the data to include proxy URLs for video playback
    const transformedData = data.map(favorite => ({
      ...favorite,
      originalUrl: favorite.video_url,
      url: `/api/proxy/video?url=${encodeURIComponent(favorite.video_url)}`
    }));

    return NextResponse.json({
      success: true,
      favorites: transformedData,
      count: transformedData.length
    });
  } catch (error) {
    console.error('Error listing favorites:', error);
    return NextResponse.json(
      { error: 'Failed to list favorites' },
      { status: 500 }
    );
  }
}