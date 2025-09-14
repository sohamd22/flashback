-- Create favorite_clips table
CREATE TABLE IF NOT EXISTS favorite_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  video_url TEXT NOT NULL, -- Permanent URL with no expiration
  query TEXT, -- The query that found this clip (optional)
  score FLOAT, -- The relevance score when found (optional)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

  -- Unique constraint to prevent duplicate favorites
  UNIQUE(user_id, chunk_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_favorite_clips_user_id ON favorite_clips(user_id);
CREATE INDEX idx_favorite_clips_video_id ON favorite_clips(video_id);
CREATE INDEX idx_favorite_clips_created_at ON favorite_clips(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE favorite_clips ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view their own favorites
CREATE POLICY "Users can view own favorites"
  ON favorite_clips
  FOR SELECT
  USING (true); -- Allow all users to view any favorites (for the view favorites by user ID feature)

-- Create policy to allow users to insert their own favorites
CREATE POLICY "Users can insert own favorites"
  ON favorite_clips
  FOR INSERT
  WITH CHECK (true); -- Allow any user to insert favorites

-- Create policy to allow users to delete their own favorites
CREATE POLICY "Users can delete own favorites"
  ON favorite_clips
  FOR DELETE
  USING (true); -- Allow users to delete any favorites (you may want to restrict this to own favorites)

-- Create policy to allow users to update their own favorites
CREATE POLICY "Users can update own favorites"
  ON favorite_clips
  FOR UPDATE
  USING (true); -- Allow users to update any favorites (you may want to restrict this to own favorites)