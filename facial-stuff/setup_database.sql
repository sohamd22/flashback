-- Facial Recognition API Database Schema
-- Run this in your Supabase SQL Editor

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add face_encoding column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS face_encoding TEXT;
-- Add reference_image column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reference_image TEXT;
-- Add video_ids column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS video_ids TEXT[] DEFAULT '{}';
-- Add profile_photo column if it doesn't exist (URL to profile photo)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- Create interactions table
CREATE TABLE IF NOT EXISTS interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_1 UUID NOT NULL,
    user_id_2 UUID NOT NULL,
    interaction_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id_1, user_id_2)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_face_encoding ON profiles(face_encoding);
CREATE INDEX IF NOT EXISTS idx_video_analyses_user_id ON video_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_video_analyses_video_id ON video_analyses(video_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user_ids ON interactions(user_id_1, user_id_2);

-- Create function to upsert interactions
CREATE OR REPLACE FUNCTION upsert_interaction(uid1 UUID, uid2 UUID, increment_by INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
    -- Ensure consistent ordering to avoid duplicate pairs
    IF uid1 > uid2 THEN
        INSERT INTO interactions (user_id_1, user_id_2, interaction_count, updated_at)
        VALUES (uid2, uid1, increment_by, NOW())
        ON CONFLICT (user_id_1, user_id_2)
        DO UPDATE SET
            interaction_count = interactions.interaction_count + increment_by,
            updated_at = NOW();
    ELSE
        INSERT INTO interactions (user_id_1, user_id_2, interaction_count, updated_at)
        VALUES (uid1, uid2, increment_by, NOW())
        ON CONFLICT (user_id_1, user_id_2)
        DO UPDATE SET
            interaction_count = interactions.interaction_count + increment_by,
            updated_at = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user interactions
CREATE OR REPLACE FUNCTION get_user_interactions(uid UUID)
RETURNS TABLE (
    other_user_id UUID,
    interaction_count INTEGER,
    last_interaction TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN i.user_id_1 = uid THEN i.user_id_2
            ELSE i.user_id_1
        END as other_user_id,
        i.interaction_count,
        i.updated_at as last_interaction
    FROM interactions i
    WHERE i.user_id_1 = uid OR i.user_id_2 = uid
    ORDER BY i.interaction_count DESC, i.updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (optional)
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Insert sample data (optional)
INSERT INTO profiles (id, name, email) VALUES
    ('baf23287-7a8a-45ff-8d6f-2fce87c88d5f', 'Test User', 'test@example.com');