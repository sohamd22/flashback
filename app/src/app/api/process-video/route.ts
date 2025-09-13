import { NextRequest, NextResponse } from 'next/server';

const MODAL_API_URL = 'https://jzflint--video-processing-api-fastapi-app.modal.run';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;
    const video = formData.get('video') as File;

    if (!userId || !video) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and video file' },
        { status: 400 }
      );
    }

    // Create a new FormData to send to Modal API
    const modalFormData = new FormData();
    modalFormData.append('user_id', userId);
    modalFormData.append('video', video);

    // Forward the request to Modal API
    const response = await fetch(`${MODAL_API_URL}/process-video`, {
      method: 'POST',
      body: modalFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Modal API error:', errorText);

      // Try to parse as JSON, otherwise return the text error
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.detail || 'Failed to process video');
      } catch {
        throw new Error(`Failed to process video: ${errorText}`);
      }
    }

    const data = await response.json();

    return NextResponse.json({
      video_id: data.video_id,
      user_id: data.user_id,
      chunk_ids: data.chunk_ids,
      total_chunks: data.total_chunks,
      duration_seconds: data.duration_seconds,
      message: `Successfully processed video into ${data.total_chunks} chunks`
    });
  } catch (error) {
    console.error('Error processing video:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process video' },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false, // Disable Next.js body parsing to handle FormData
  },
};