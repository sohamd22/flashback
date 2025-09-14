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

-- Table to store video analysis results
CREATE TABLE video_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    video_url TEXT NOT NULL,
    total_chunks INTEGER NOT NULL,
    analysis_results JSONB NOT NULL, -- Store the face interaction results
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_video_analyses_user_id ON video_analyses(user_id);
CREATE INDEX idx_video_analyses_video_id ON video_analyses(video_id);

-- Table to track individual chunk face detections (for debugging/detailed analysis)
CREATE TABLE chunk_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    contact_id UUID REFERENCES contacts(id),
    confidence FLOAT NOT NULL,
    bbox JSONB, -- Bounding box coordinates
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chunk_detections_video_id ON chunk_detections(video_id);
CREATE INDEX idx_chunk_detections_contact_id ON chunk_detections(contact_id);