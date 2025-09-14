import { NextRequest, NextResponse } from 'next/server';

const MODAL_API_URL = 'https://jzflint--video-processing-api-fastapi-app.modal.run';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, query, topK = 10 } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Call Modal API to retrieve clips/photos
    const response = await fetch(`${MODAL_API_URL}/retrieve-clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        query: query || '', // Empty query returns all
        top_k: topK,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Modal API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to search photos' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Filter to only include photos (where chunk_id equals video_id)
    // This distinguishes photos from video chunks
    const photoClips = data.clips.filter((clip: any) =>
      clip.chunk_id === clip.video_id
    );

    // Transform the response to match our photo format
    const photos = photoClips.map((clip: any) => ({
      id: clip.chunk_id,
      photo_id: clip.video_id, // video_id is actually photo_id for photos
      url: clip.url,
      description: '', // Will be populated from metadata if available
      score: clip.score,
      user_id: clip.user_id,
      created_at: clip.expires_at, // Using expires_at as a timestamp reference
    }));

    return NextResponse.json({
      photos,
      query: query || '',
      total_results: photos.length,
    });

  } catch (error) {
    console.error('Error searching photos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}