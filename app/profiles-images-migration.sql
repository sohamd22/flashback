-- Migration to create profiles_images table and sync mechanism
-- This ensures facial recognition service can access profile data with photos

-- Create profiles_images table (mirrors profiles structure with additional facial recognition fields)
CREATE TABLE IF NOT EXISTS profiles_images (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  profile_photo TEXT, -- base64 encoded profile photo
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

  -- Facial recognition specific fields
  reference_image TEXT, -- base64 encoded reference image for facial recognition
  face_encoding TEXT, -- base64 encoded face encoding from face_recognition library
  video_ids TEXT[] DEFAULT ARRAY[]::TEXT[] -- array of video IDs where this profile was detected
);

-- Make profiles_images publicly accessible (no RLS)
-- This allows the facial recognition service to access profile data without authentication
-- ALTER TABLE profiles_images ENABLE ROW LEVEL SECURITY; -- Commented out for public access

-- Create trigger to update the updated_at column for profiles_images
CREATE TRIGGER update_profiles_images_updated_at
  BEFORE UPDATE ON profiles_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to sync profile data to profiles_images when profile_photo is added/updated
CREATE OR REPLACE FUNCTION sync_profile_to_images()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if profile_photo is present and not null/empty
  IF NEW.profile_photo IS NOT NULL AND NEW.profile_photo != '' THEN
    -- Insert or update in profiles_images table
    INSERT INTO profiles_images (
      id,
      email,
      name,
      profile_photo,
      onboarding_complete,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      NEW.name,
      NEW.profile_photo,
      NEW.onboarding_complete,
      NEW.created_at,
      NEW.updated_at
    )
    ON CONFLICT (id)
    DO UPDATE SET
      email = NEW.email,
      name = NEW.name,
      profile_photo = NEW.profile_photo,
      onboarding_complete = NEW.onboarding_complete,
      updated_at = NEW.updated_at;

    -- Log the sync operation
    RAISE NOTICE 'Synced profile % to profiles_images with photo', NEW.id;
  ELSE
    -- If profile_photo is removed, we might want to keep the record but flag it
    -- or remove it entirely. For now, we'll keep it but could add logic here.
    NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles table to sync when profile_photo changes
CREATE TRIGGER sync_profile_photo_to_images
  AFTER INSERT OR UPDATE OF profile_photo ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_to_images();

-- Migrate existing profiles with photos to profiles_images
INSERT INTO profiles_images (
  id,
  email,
  name,
  profile_photo,
  onboarding_complete,
  created_at,
  updated_at
)
SELECT
  id,
  email,
  name,
  profile_photo,
  onboarding_complete,
  created_at,
  updated_at
FROM profiles
WHERE profile_photo IS NOT NULL
  AND profile_photo != ''
  AND id NOT IN (SELECT id FROM profiles_images)
ON CONFLICT (id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_images_email ON profiles_images(email);
CREATE INDEX IF NOT EXISTS idx_profiles_images_face_encoding ON profiles_images(face_encoding) WHERE face_encoding IS NOT NULL;
-- Skip indexing profile_photo due to large base64 data size (exceeds 8191 bytes limit)
-- CREATE INDEX IF NOT EXISTS idx_profiles_images_profile_photo ON profiles_images(profile_photo) WHERE profile_photo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_images_video_ids ON profiles_images USING GIN (video_ids);

-- Function to get profiles with photos (for facial recognition service)
CREATE OR REPLACE FUNCTION get_profiles_with_photos()
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  profile_photo TEXT,
  face_encoding TEXT,
  reference_image TEXT,
  video_ids TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.email,
    p.profile_photo,
    p.face_encoding,
    p.reference_image,
    p.video_ids
  FROM profiles_images p
  WHERE p.profile_photo IS NOT NULL
    AND p.profile_photo != '';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant public access permissions
GRANT SELECT ON profiles_images TO anon;
GRANT SELECT ON profiles_images TO authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles_images TO service_role;