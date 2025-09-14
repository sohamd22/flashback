import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const MODAL_API_URL = 'https://jzflint--video-processing-api-fastapi-app.modal.run';

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      chunkId,
      videoId,
      videoUrl,
      query,
      score
    } = await request.json();

    if (!userId || !chunkId || !videoId || !videoUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, chunkId, videoId, and videoUrl are required' },
        { status: 400 }
      );
    }

    // For now, store the original URL. In production, you would want to:
    // 1. Call Modal API with a longer expiration time or
    // 2. Store the video in your own storage (S3, etc.) or
    // 3. Implement a refresh mechanism for expired URLs
    let permanentUrl = videoUrl;

    // Note: The Modal API currently returns presigned URLs with expiration.
    // To make them truly permanent, you would need to either:
    // - Store the videos in your own storage
    // - Implement a URL refresh mechanism
    // - Configure Modal to return non-expiring URLs

    // Insert the favorite into Supabase
    const { data, error } = await supabase
      .from('favorite_clips')
      .insert({
        user_id: userId,
        chunk_id: chunkId,
        video_id: videoId,
        video_url: permanentUrl,
        query: query || null,
        score: score || null
      })
      .select()
      .single();

    if (error) {
      // Check if it's a duplicate key error
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This clip is already in your favorites' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      favorite: data
    });
  } catch (error) {
    console.error('Error adding favorite:', error);
    return NextResponse.json(
      { error: 'Failed to add favorite' },
      { status: 500 }
    );
  }
}