import { NextRequest, NextResponse } from 'next/server';

const MODAL_API_URL = 'https://jzflint--video-processing-api-fastapi-app.modal.run';

export async function POST(request: NextRequest) {
  try {
    const { userId, query, topK = 5 } = await request.json();

    if (!userId || !query) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and query' },
        { status: 400 }
      );
    }

    // Call the Modal API to retrieve clips
    const response = await fetch(`${MODAL_API_URL}/retrieve-clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        query: query,
        top_k: topK
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
        ...clip,
        originalUrl: clip.url,
        url: `/api/proxy/video?url=${encodeURIComponent(clip.url)}`
      }))
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error querying videos:', error);
    return NextResponse.json(
      { error: 'Failed to query videos' },
      { status: 500 }
    );
  }
}