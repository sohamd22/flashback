import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const videoUrl = searchParams.get('url');

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Missing video URL parameter' },
        { status: 400 }
      );
    }

    // Fetch the video from the presigned URL
    const response = await fetch(decodeURIComponent(videoUrl), {
      headers: {
        'Accept': 'video/*,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }

    // Get the content type and create appropriate headers
    const contentType = response.headers.get('content-type') || 'video/mp4';
    const contentLength = response.headers.get('content-length');

    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });

    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    // Stream the video content
    const videoStream = response.body;

    if (!videoStream) {
      throw new Error('No video stream available');
    }

    return new NextResponse(videoStream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error proxying video:', error);
    return NextResponse.json(
      { error: 'Failed to proxy video' },
      { status: 500 }
    );
  }
}