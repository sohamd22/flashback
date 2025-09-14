import { NextRequest, NextResponse } from 'next/server';

const MODAL_API_URL = 'https://jzflint--video-processing-api-fastapi-app.modal.run';

export async function POST(request: NextRequest) {
  try {
    const { user_id, query = '', top_k = 50 } = await request.json();

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing required field: user_id' },
        { status: 400 }
      );
    }

    // For empty query, use a generic query that should match many videos
    const searchQuery = query.trim() === '' ? 'video' : query;

    // Call the Modal API to retrieve clips
    const response = await fetch(`${MODAL_API_URL}/retrieve-clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user_id,
        query: searchQuery,
        top_k: top_k
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Modal API error: ${error}`);
    }

    const data = await response.json();

    // Transform the URLs to use our proxy
    const transformedData = {
      ...data,
      clips: data.clips.map((clip: any) => ({
        id: clip.chunk_id,
        chunk_id: clip.chunk_id,
        video_id: clip.video_id,
        video_url: clip.url,
        originalUrl: clip.url,
        url: `/api/proxy/video?url=${encodeURIComponent(clip.url)}`,
        query: query || undefined,
        score: clip.score,
        user_id: clip.user_id || user_id
      }))
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error retrieving clips:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve clips' },
      { status: 500 }
    );
  }
}