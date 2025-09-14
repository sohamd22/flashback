import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  name?: string;
  profile_photo?: string;
  onboarding_complete: boolean;
  created_at?: string;
  updated_at?: string;
  reference_image?: string; // base64 encoded reference image for facial recognition
  face_encoding?: string; // base64 encoded face encoding
  video_ids?: string[]; // array of video IDs where this profile was detected
};

export type Interaction = {
  id: string;
  user_id_1: string;
  user_id_2: string;
  interaction_count: number;
  created_at: string;
  updated_at: string;
};