import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function DELETE(request: NextRequest) {
  try {
    const { userId, chunkId } = await request.json();

    if (!userId || !chunkId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and chunkId' },
        { status: 400 }
      );
    }

    // Delete the favorite from Supabase
    const { error } = await supabase
      .from('favorite_clips')
      .delete()
      .eq('user_id', userId)
      .eq('chunk_id', chunkId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Favorite removed successfully'
    });
  } catch (error) {
    console.error('Error removing favorite:', error);
    return NextResponse.json(
      { error: 'Failed to remove favorite' },
      { status: 500 }
    );
  }
}