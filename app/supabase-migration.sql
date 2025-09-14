-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  profile_photo TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Create policy to allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Create policy to allow users to insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Optional: Create a trigger to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, onboarding_complete)
  VALUES (NEW.id, NEW.email, FALSE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Add facial recognition fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reference_image TEXT; -- base64 encoded reference image for facial recognition
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS face_encoding TEXT; -- base64 encoded face encoding
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS video_ids TEXT[] DEFAULT ARRAY[]::TEXT[]; -- array of video IDs where this profile was detected

-- Create interactions table with proper user ID ordering
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id_2 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  interaction_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

  -- Ensure user_id_1 < user_id_2 to avoid duplicate pairs
  CONSTRAINT interactions_ordered_check CHECK (user_id_1 < user_id_2),

  -- Unique constraint on the ordered pair
  UNIQUE(user_id_1, user_id_2)
);

-- Create indexes for interactions table
CREATE INDEX IF NOT EXISTS idx_interactions_user_id_1 ON interactions(user_id_1);
CREATE INDEX IF NOT EXISTS idx_interactions_user_id_2 ON interactions(user_id_2);
CREATE INDEX IF NOT EXISTS idx_interactions_count ON interactions(interaction_count DESC);

-- Enable RLS on interactions table
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Create policies for interactions table
CREATE POLICY "Users can view interactions they're part of"
  ON interactions
  FOR SELECT
  USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "System can insert interactions"
  ON interactions
  FOR INSERT
  WITH CHECK (true); -- Allow system to insert interactions

CREATE POLICY "System can update interactions"
  ON interactions
  FOR UPDATE
  USING (true); -- Allow system to update interactions

-- Create function to safely upsert interactions with proper ordering
CREATE OR REPLACE FUNCTION upsert_interaction(
  uid1 UUID,
  uid2 UUID,
  increment_by INTEGER DEFAULT 1
)
RETURNS VOID AS $$
DECLARE
  ordered_uid1 UUID;
  ordered_uid2 UUID;
BEGIN
  -- Ensure proper ordering: smaller UUID first
  IF uid1 < uid2 THEN
    ordered_uid1 := uid1;
    ordered_uid2 := uid2;
  ELSE
    ordered_uid1 := uid2;
    ordered_uid2 := uid1;
  END IF;

  -- Upsert the interaction
  INSERT INTO interactions (user_id_1, user_id_2, interaction_count, updated_at)
  VALUES (ordered_uid1, ordered_uid2, increment_by, TIMEZONE('utc', NOW()))
  ON CONFLICT (user_id_1, user_id_2)
  DO UPDATE SET
    interaction_count = interactions.interaction_count + increment_by,
    updated_at = TIMEZONE('utc', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get interactions for a user
CREATE OR REPLACE FUNCTION get_user_interactions(uid UUID)
RETURNS TABLE (
  other_user_id UUID,
  other_user_name TEXT,
  other_user_email TEXT,
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
    p.name as other_user_name,
    p.email as other_user_email,
    i.interaction_count,
    i.updated_at as last_interaction
  FROM interactions i
  JOIN profiles p ON (
    CASE
      WHEN i.user_id_1 = uid THEN i.user_id_2
      ELSE i.user_id_1
    END = p.id
  )
  WHERE i.user_id_1 = uid OR i.user_id_2 = uid
  ORDER BY i.interaction_count DESC, i.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;