-- Supabase schema for facial recognition contacts
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT,
    face_encoding TEXT NOT NULL, -- Base64 encoded serialized face encoding
    image_url TEXT, -- URL to stored face image in GCS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
