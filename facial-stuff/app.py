import modal
import os
import logging
import cv2
import face_recognition
import numpy as np
import tempfile
import subprocess
import uuid
import requests
import pickle
import base64
import re
from typing import List, Optional, Dict, Tuple, BinaryIO, Any
from datetime import datetime
from collections import defaultdict
from dataclasses import dataclass

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------
# Utilities


def decode_image_base64_str(image_str: str) -> bytes:
    """Decode a base64 image string into raw bytes.

    Supports plain base64 strings and data URLs (e.g. "data:image/jpeg;base64,...").
    Strips whitespace/newlines, fixes missing padding, and raises ValueError on failure.
    """
    if not image_str or not isinstance(image_str, str):
        raise ValueError("image_data must be a non-empty base64 string")

    original_length = len(image_str)
    logger.info(f"Starting base64 decode for string of length {original_length}")

    # Remove data URL prefix if present
    if image_str.startswith("data:image/"):
        try:
            image_str = image_str.split(",", 1)[1]
            logger.info(f"Removed data URL prefix, new length: {len(image_str)}")
        except Exception:
            raise ValueError("Invalid data URL format for image_data")

    # Remove whitespace/newlines and any other non-base64 characters
    # Valid base64 characters are A-Z, a-z, 0-9, +, /, and = for padding
    clean_str = re.sub(r'[^A-Za-z0-9+/=]', '', image_str)
    logger.info(f"After cleaning invalid characters, length: {len(clean_str)} (removed {len(image_str) - len(clean_str)} chars)")

    # Remove any existing padding first
    clean_str = clean_str.rstrip('=')
    logger.info(f"After removing existing padding, length: {len(clean_str)}")
    
    # Fix padding if necessary (base64 length must be multiple of 4)
    padding_needed = (-len(clean_str)) % 4
    if padding_needed:
        clean_str += "=" * padding_needed
        logger.info(f"Added {padding_needed} padding characters, final length: {len(clean_str)}")

    try:
        decoded = base64.b64decode(clean_str, validate=False)
        logger.info(f"Successfully decoded base64 string to {len(decoded)} bytes")
    except Exception as e:
        logger.error(f"Standard b64decode failed: {str(e)}")
        # Fallback to urlsafe decoding if regular fails
        try:
            decoded = base64.urlsafe_b64decode(clean_str)
            logger.info(f"Successfully decoded with urlsafe_b64decode to {len(decoded)} bytes")
        except Exception as e2:
            logger.error(f"urlsafe_b64decode also failed: {str(e2)}")
            # Final fallback - try without validation
            try:
                decoded = base64.b64decode(clean_str, validate=False)
                logger.info(f"Successfully decoded with validate=False to {len(decoded)} bytes")
            except Exception as e3:
                logger.error(f"All decode methods failed. Final error: {str(e3)}")
                logger.error(f"String sample: {clean_str[:100]}...")
                raise ValueError(f"Failed to decode base64 image_data after all attempts: {str(e3)}")

    if not decoded:
        raise ValueError("Decoded image_data is empty")

    return decoded

def try_repair_base64(b64_str: str) -> str:
    """Try to repair a potentially corrupted base64 string."""
    # Remove any whitespace
    b64_str = re.sub(r'\s', '', b64_str)
    
    # Remove common corruption characters
    b64_str = b64_str.replace('.', '')  # Periods are common corruption
    
    # Keep only valid base64 characters
    b64_str = re.sub(r'[^A-Za-z0-9+/=]', '', b64_str)
    
    # Remove existing padding
    b64_str = b64_str.rstrip('=')
    
    # Add correct padding
    padding_needed = (-len(b64_str)) % 4
    if padding_needed:
        b64_str += "=" * padding_needed
        
    return b64_str

def debug_base64_string(b64_str: str, profile_id: str = "unknown") -> Dict[str, Any]:
    """Debug function to analyze a base64 string and return diagnostics"""
    diagnostics = {
        "profile_id": profile_id,
        "original_length": len(b64_str),
        "has_data_url_prefix": b64_str.startswith("data:image/"),
        "starts_with": b64_str[:50] if len(b64_str) > 50 else b64_str,
        "ends_with": b64_str[-50:] if len(b64_str) > 50 else b64_str,
    }
    
    # Remove data URL prefix if present
    work_str = b64_str
    if work_str.startswith("data:image/"):
        try:
            work_str = work_str.split(",", 1)[1]
            diagnostics["after_prefix_removal"] = len(work_str)
        except:
            diagnostics["prefix_removal_error"] = True
            return diagnostics
    
    # Count valid vs invalid characters
    valid_chars = len(re.findall(r'[A-Za-z0-9+/=]', work_str))
    invalid_chars = len(work_str) - valid_chars
    diagnostics["valid_chars"] = valid_chars
    diagnostics["invalid_chars"] = invalid_chars
    
    # Check character distribution
    char_counts = {}
    for char in set(work_str):
        if char not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=":
            char_counts[char] = work_str.count(char)
    diagnostics["invalid_char_counts"] = char_counts
    
    # Check padding
    diagnostics["ends_with_padding"] = work_str.endswith("=")
    diagnostics["padding_count"] = len(work_str) - len(work_str.rstrip('='))
    
    return diagnostics

def test_base64_decode() -> bool:
    """Test function to validate base64 decoding functionality"""
    try:
        # Test with a simple base64 encoded string (a small 1x1 pixel JPEG)
        test_b64 = "/9j/4AAQSkZJRgABAQAAAQABAAD//2Q=="  # 1x1 transparent JPEG
        result = decode_image_base64_str(test_b64)
        logger.info(f"Test decode successful: {len(result)} bytes")
        
        # Test with data URL prefix
        test_data_url = "data:image/jpeg;base64," + test_b64
        result2 = decode_image_base64_str(test_data_url)
        logger.info(f"Test decode with data URL successful: {len(result2)} bytes")
        
        return True
    except Exception as e:
        logger.error(f"Test decode failed: {str(e)}")
        return False

# Pydantic models (schemas)
class ProfileInput(BaseModel):
    profile_id: str
    image_data: str
    name: Optional[str] = None

class AnalyzeVideoRequest(BaseModel):
    requester_user_id: str  # The user making the request
    video_url: str
    target_profiles: Optional[List[str]] = None  # Specific profile IDs to look for, if None uses all profiles

class InteractionData(BaseModel):
    profile_id: str
    profile_name: Optional[str]
    profile_email: str
    chunk_appearances: int
    interactions: Dict[str, int]  # profile_id -> number of shared chunks
    face_images: List[str] = []  # base64 encoded face images

class AnalyzeVideoResponse(BaseModel):
    video_id: str
    requester_user_id: str
    video_url: str
    total_chunks: int
    detected_profiles: Dict[str, InteractionData]  # profile_id -> interaction data
    new_interactions: List[Dict[str, Any]] = []  # List of new interactions created

class GetAnalysisRequest(BaseModel):
    requester_user_id: str
    video_id: str

class GetAnalysisResponse(BaseModel):
    video_id: str
    requester_user_id: str
    video_url: str
    total_chunks: int
    detected_profiles: Dict[str, InteractionData]
    created_at: datetime

class ProfileSummary(BaseModel):
    id: str
    name: Optional[str]
    email: str
    has_face_data: bool
    video_count: int

class ListProfilesResponse(BaseModel):
    total_profiles: int
    profiles_with_face_data: int
    profiles: List[ProfileSummary]

class AddFaceDataRequest(BaseModel):
    image_data: str

# Data classes for internal processing
@dataclass
class ServiceProfileInput:
    profile_id: str
    image_data: Optional[bytes] = None
    name: Optional[str] = None

@dataclass
class FaceDetection:
    face_encoding: np.ndarray
    bbox: Tuple[int, int, int, int]  # top, right, bottom, left
    confidence: float
    frame_number: int

@dataclass
class MatchResult:
    profile_id: str
    confidence: float
    is_existing_profile: bool

@dataclass
class InteractionResult:
    profile_id: str
    profile_name: Optional[str]
    profile_email: str
    chunk_appearances: int
    interactions: Dict[str, int]  # profile_id -> number of shared chunks
    face_images: List[str] = None  # base64 encoded face images

    def __post_init__(self):
        if self.face_images is None:
            self.face_images = []

# Services classes
class SupabaseClient:
    def __init__(self, supabase_url: str, supabase_key: str):
        self.client: Client = create_client(supabase_url, supabase_key)

    def upsert_profile_face_data(
        self,
        profile_id: str,
        face_encoding: np.ndarray,
        reference_image: Optional[str] = None,
    ) -> Dict:
        """Update profile with face encoding and reference image"""
        try:
            # Serialize the face encoding and encode as base64 for JSON compatibility
            encoding_bytes = pickle.dumps(face_encoding)
            encoding_b64 = base64.b64encode(encoding_bytes).decode('utf-8')

            update_data = {
                "face_encoding": encoding_b64,
                "updated_at": datetime.now().isoformat(),
            }

            if reference_image:
                update_data["reference_image"] = reference_image

            logger.info(f"Updating profile {profile_id} with face encoding using direct HTTP API...")

            # Use direct HTTP call to avoid Supabase client issues
            import requests
            url = f"https://ndojkhkubndmfdgifnhy.supabase.co/rest/v1/profiles_images?id=eq.{profile_id}"
            headers = {
                "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kb2praGt1Ym5kbWZkZ2lmbmh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc5NzkyNiwiZXhwIjoyMDczMzczOTI2fQ.ham5FFwZThvvJM0aLzqgoUiCoT7h2bkOI3gmu5YBZtU",
                "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kb2praGt1Ym5kbWZkZ2lmbmh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc5NzkyNiwiZXhwIjoyMDczMzczOTI2fQ.ham5FFwZThvvJM0aLzqgoUiCoT7h2bkOI3gmu5YBZtU",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            }

            response = requests.patch(url, json=update_data, headers=headers)
            response.raise_for_status()

            result_data = response.json()
            logger.info(f"Successfully updated profile {profile_id} with face encoding")
            logger.info(f"Update result: {result_data}")

            return result_data[0] if result_data else {}

        except Exception as e:
            logger.error(f"Error updating profile face data: {str(e)}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            raise

    def get_all_profiles_with_photos(self) -> List[Dict]:
        """Get all profiles that have profile photos"""
        try:
            logger.info("Fetching profiles with photos using direct HTTP API...")

            # Use direct HTTP call since Supabase client queries are failing
            import requests
            url = "https://ndojkhkubndmfdgifnhy.supabase.co/rest/v1/profiles_images?select=id%2Cname%2Cemail%2Cface_encoding%2Cprofile_photo%2Creference_image%2Cvideo_ids&apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kb2praGt1Ym5kbWZkZ2lmbmh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc5NzkyNiwiZXhwIjoyMDczMzczOTI2fQ.ham5FFwZThvvJM0aLzqgoUiCoT7h2bkOI3gmu5YBZtU"

            response = requests.get(url)
            response.raise_for_status()
            all_data = response.json()
            logger.info(f"Direct fetch returned {len(all_data)} profiles")

            # Filter for profiles with photos
            filtered_profiles = [p for p in all_data if bool(p.get('profile_photo'))]
            logger.info(f"Profiles with photos via direct fetch: {len(filtered_profiles)}")

            # Log some sample data
            for profile in filtered_profiles[:3]:
                logger.info(f"Sample profile {profile.get('id')}: profile_photo={profile.get('profile_photo')[:100] if profile.get('profile_photo') else 'None'}...")

            # Process the profiles
            profiles = []
            for profile in filtered_profiles:
                logger.info(f"Processing profile {profile.get('id')}: has_face_encoding={bool(profile.get('face_encoding'))}, has_profile_photo={bool(profile.get('profile_photo'))}")

                # If face encoding exists, deserialize it
                if bool(profile.get("face_encoding")):
                    try:
                        encoding_b64 = profile["face_encoding"]
                        encoding_bytes = base64.b64decode(encoding_b64.encode('utf-8'))
                        face_encoding = pickle.loads(encoding_bytes)
                        profile["face_encoding"] = face_encoding
                        logger.info(f"Successfully deserialized face encoding for profile {profile.get('id')}")
                    except Exception as e:
                        logger.error(f"Failed to deserialize face encoding for profile {profile.get('id')}: {str(e)}")

                profiles.append(profile)

            logger.info(f"Retrieved {len(profiles)} profiles with photos via direct HTTP API")
            return profiles

        except Exception as e:
            logger.error(f"Error retrieving profiles with photos: {str(e)}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            raise

    def get_profiles_by_ids(self, profile_ids: List[str]) -> List[Dict]:
        """Get specific profiles by their IDs"""
        try:
            result = (
                self.client.table("profiles_images")
                .select("id, name, email, face_encoding, reference_image, video_ids, profile_photo")
                .in_("id", profile_ids)
                .execute()
            )

            profiles = []
            for profile in result.data:
                # If face encoding exists, deserialize it
                if bool(profile.get("face_encoding")):
                    encoding_b64 = profile["face_encoding"]
                    encoding_bytes = base64.b64decode(encoding_b64.encode('utf-8'))
                    face_encoding = pickle.loads(encoding_bytes)
                    profile["face_encoding"] = face_encoding
                profiles.append(profile)

            logger.info(f"Retrieved {len(profiles)} specific profiles")
            return profiles

        except Exception as e:
            logger.error(f"Error retrieving specific profiles: {str(e)}")
            raise

    def add_video_to_profile(self, profile_id: str, video_id: str) -> Dict:
        """Add video ID to profile's video_ids array"""
        try:
            # First get current video_ids
            result = (
                self.client.table("profiles_images")
                .select("video_ids")
                .eq("id", profile_id)
                .single()
                .execute()
            )

            current_video_ids = result.data.get("video_ids", []) if result.data else []

            # Add video_id if not already present
            if video_id not in current_video_ids:
                current_video_ids.append(video_id)

                # Update the profile
                update_result = (
                    self.client.table("profiles_images")
                    .update({"video_ids": current_video_ids, "updated_at": datetime.now().isoformat()})
                    .eq("id", profile_id)
                    .execute()
                )

                logger.info(f"Added video {video_id} to profile {profile_id}")
                return update_result.data[0] if update_result.data else {}

            return result.data

        except Exception as e:
            logger.error(f"Error adding video to profile: {str(e)}")
            raise

    def upsert_interaction(self, user_id_1: str, user_id_2: str, increment: int = 1) -> Dict:
        """Upsert interaction between two users using the database function"""
        try:
            result = self.client.rpc(
                "upsert_interaction",
                {
                    "uid1": user_id_1,
                    "uid2": user_id_2,
                    "increment_by": increment
                }
            ).execute()

            logger.info(f"Upserted interaction between {user_id_1} and {user_id_2}")
            return result.data

        except Exception as e:
            logger.error(f"Error upserting interaction: {str(e)}")
            raise

    def store_chunk_detection(
        self,
        video_id: str,
        chunk_index: int,
        profile_id: str,
        confidence: float,
        bbox: Optional[Dict] = None,
    ) -> Dict:
        """Store individual chunk detection for debugging"""
        try:
            detection_data = {
                "video_id": video_id,
                "chunk_index": chunk_index,
                "contact_id": profile_id,  # Using profile_id as contact_id for backward compatibility
                "confidence": confidence,
                "bbox": bbox,
            }

            result = (
                self.client.table("chunk_detections")
                .insert(detection_data)
                .execute()
            )

            return result.data[0] if result.data else {}

        except Exception as e:
            logger.error(f"Error storing chunk detection: {str(e)}")
            raise

class VideoChunker:
    def __init__(self, chunk_duration_seconds: int = 5):
        self.chunk_duration = chunk_duration_seconds
        self.temp_dir = "/tmp"

    def download_video_from_url(self, video_url: str) -> bytes:
        """Download video from URL and return bytes"""
        try:
            response = requests.get(video_url, stream=True)
            response.raise_for_status()
            return response.content
        except Exception as e:
            logger.error(f"Failed to download video from {video_url}: {str(e)}")
            raise

    def get_video_duration(self, video_path: str) -> float:
        """Get the duration of a video file in seconds"""
        try:
            cmd = [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                video_path,
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            duration = float(result.stdout.strip())
            logger.info(f"Video duration: {duration} seconds")
            return duration
        except Exception as e:
            logger.error(f"Failed to get video duration: {str(e)}")
            raise

    def split_video_from_url(self, video_url: str, video_id: str) -> List[Tuple[str, bytes, int, float, float]]:
        """
        Download video from URL and split into chunks
        Returns list of (chunk_id, chunk_data, chunk_index, start_time, end_time)
        """
        # Download video
        video_data = self.download_video_from_url(video_url)
        return self.split_video(video_data, video_id)

    def split_video(
        self, video_data: bytes, video_id: str
    ) -> List[Tuple[str, bytes, int, float, float]]:
        """
        Split video into chunks of specified duration
        Returns list of (chunk_id, chunk_data, chunk_index, start_time, end_time)
        """
        chunks = []

        with tempfile.NamedTemporaryFile(
            suffix=".mp4", dir=self.temp_dir, delete=False
        ) as input_file:
            input_file.write(video_data)
            input_file.flush()
            input_path = input_file.name

            try:
                duration = self.get_video_duration(input_path)
                num_chunks = int(duration / self.chunk_duration) + (
                    1 if duration % self.chunk_duration > 0 else 0
                )

                logger.info(
                    f"Splitting video into {num_chunks} chunks of {self.chunk_duration} seconds"
                )

                for i in range(num_chunks):
                    chunk_id = str(uuid.uuid4())
                    start_time = i * self.chunk_duration
                    end_time = min((i + 1) * self.chunk_duration, duration)
                    actual_duration = end_time - start_time

                    output_path = os.path.join(self.temp_dir, f"{chunk_id}.mp4")

                    try:
                        cmd = [
                            "ffmpeg",
                            "-i",
                            input_path,
                            "-ss",
                            str(start_time),
                            "-t",
                            str(actual_duration),
                            "-c:v",
                            "libx264",
                            "-c:a",
                            "aac",
                            "-preset",
                            "fast",
                            "-movflags",
                            "+faststart",
                            "-y",
                            output_path,
                        ]

                        subprocess.run(cmd, capture_output=True, check=True)

                        with open(output_path, "rb") as chunk_file:
                            chunk_data = chunk_file.read()

                        chunks.append((chunk_id, chunk_data, i, start_time, end_time))
                        logger.info(f"Created chunk {i + 1}/{num_chunks}: {chunk_id}")

                    except subprocess.CalledProcessError as e:
                        logger.error(f"Failed to create chunk {i}: {e.stderr.decode()}")
                        raise
                    finally:
                        if os.path.exists(output_path):
                            os.remove(output_path)

            finally:
                if os.path.exists(input_path):
                    os.remove(input_path)

        logger.info(f"Successfully split video into {len(chunks)} chunks")
        return chunks

    def validate_video(self, video_data: bytes) -> bool:
        """Validate that the uploaded file is a valid video"""
        with tempfile.NamedTemporaryFile(
            suffix=".mp4", dir=self.temp_dir, delete=False
        ) as temp_file:
            temp_file.write(video_data)
            temp_file.flush()
            temp_path = temp_file.name

            try:
                cmd = [
                    "ffprobe",
                    "-v",
                    "error",
                    "-select_streams",
                    "v:0",
                    "-show_entries",
                    "stream=codec_type",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    temp_path,
                ]
                result = subprocess.run(cmd, capture_output=True, text=True)
                is_valid = result.stdout.strip() == "video"
                logger.info(f"Video validation: {'valid' if is_valid else 'invalid'}")
                return is_valid
            except Exception as e:
                logger.error(f"Failed to validate video: {str(e)}")
                return False
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)

class FaceProcessor:
    def __init__(
        self,
        face_match_threshold: float = 0.6,
        new_contact_threshold: float = 0.5,
        frame_skip: int = 3,  # Process every 3rd frame for speed
        detection_scale: float = 0.5,  # Scale down frames for detection
    ):
        self.face_match_threshold = face_match_threshold
        self.new_contact_threshold = new_contact_threshold
        self.frame_skip = frame_skip
        self.detection_scale = detection_scale

    def extract_frames_from_video_chunk(self, video_chunk_data: bytes) -> List[np.ndarray]:
        """Extract all frames from a video chunk"""
        frames = []

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_file:
            temp_file.write(video_chunk_data)
            temp_file.flush()
            temp_path = temp_file.name

            try:
                cap = cv2.VideoCapture(temp_path)

                frame_number = 0
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break

                    # Convert BGR to RGB for face_recognition
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    frames.append(rgb_frame)
                    frame_number += 1

                cap.release()
                logger.info(f"Extracted {len(frames)} frames from video chunk")
                return frames

            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)

    def detect_faces_in_frame(self, frame: np.ndarray, frame_number: int, original_frame: np.ndarray = None) -> List[FaceDetection]:
        """Detect all faces in a single frame with optimization"""
        try:
            # Scale down frame for detection to improve speed
            if self.detection_scale != 1.0:
                height, width = frame.shape[:2]
                new_height, new_width = int(height * self.detection_scale), int(width * self.detection_scale)
                detection_frame = cv2.resize(frame, (new_width, new_height))
                scale_factor = 1.0 / self.detection_scale
            else:
                detection_frame = frame
                scale_factor = 1.0

            # Find face locations and encodings on scaled frame
            face_locations = face_recognition.face_locations(detection_frame, model="hog")

            # If we scaled down, we need to get encodings from original resolution
            if self.detection_scale != 1.0 and face_locations:
                # Scale face locations back to original frame size
                scaled_locations = []
                for (top, right, bottom, left) in face_locations:
                    scaled_locations.append((
                        int(top * scale_factor),
                        int(right * scale_factor),
                        int(bottom * scale_factor),
                        int(left * scale_factor)
                    ))
                # Get encodings from original frame at scaled locations
                face_encodings = face_recognition.face_encodings(frame, scaled_locations)
                face_locations = scaled_locations
            else:
                face_encodings = face_recognition.face_encodings(detection_frame, face_locations)

            detections = []
            for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
                # Calculate confidence based on face detection quality
                face_area = (right - left) * (bottom - top)
                confidence = min(1.0, face_area / 5000)  # Adjusted threshold for scaled detection

                detection = FaceDetection(
                    face_encoding=face_encoding,
                    bbox=(top, right, bottom, left),
                    confidence=confidence,
                    frame_number=frame_number
                )
                detections.append(detection)

            return detections

        except Exception as e:
            logger.error(f"Error detecting faces in frame {frame_number}: {str(e)}")
            return []

    def process_video_chunk_faces(self, video_chunk_data: bytes) -> List[FaceDetection]:
        """Process all faces in a video chunk across selected frames for speed"""
        all_detections = []

        frames = self.extract_frames_from_video_chunk(video_chunk_data)

        # Process only every Nth frame for speed optimization
        selected_frames = frames[::self.frame_skip]

        for i, frame in enumerate(selected_frames):
            # Calculate the actual frame number in the original sequence
            actual_frame_number = i * self.frame_skip
            detections = self.detect_faces_in_frame(frame, actual_frame_number)
            all_detections.extend(detections)

        logger.info(f"Detected {len(all_detections)} total faces across {len(selected_frames)}/{len(frames)} frames (skip={self.frame_skip})")
        return all_detections

    def match_face_to_profiles(
        self,
        face_encoding: np.ndarray,
        profile_encodings: Dict[str, np.ndarray]
    ) -> Optional[MatchResult]:
        """Match a face encoding to existing profiles"""
        if not profile_encodings:
            return None

        profile_ids = list(profile_encodings.keys())
        known_encodings = list(profile_encodings.values())

        # Calculate distances to all known faces
        distances = face_recognition.face_distance(known_encodings, face_encoding)

        # Find the best match
        min_distance_idx = np.argmin(distances)
        min_distance = distances[min_distance_idx]

        # Convert distance to confidence (lower distance = higher confidence)
        confidence = 1.0 - min_distance

        if confidence >= self.face_match_threshold:
            return MatchResult(
                profile_id=profile_ids[min_distance_idx],
                confidence=confidence,
                is_existing_profile=True
            )

        return None

    def create_face_encoding_from_image(self, image_data: bytes) -> np.ndarray:
        """Create face encoding from an uploaded image"""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            temp_file.write(image_data)
            temp_file.flush()
            temp_path = temp_file.name

            try:
                # Load and process the image
                image = face_recognition.load_image_file(temp_path)

                # Find face encodings
                encodings = face_recognition.face_encodings(image)

                if not encodings:
                    raise ValueError("No face found in the uploaded image")

                if len(encodings) > 1:
                    logger.warning("Multiple faces found in image, using the first one")

                return encodings[0]

            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)

    def group_faces_in_chunk(self, face_detections: List[FaceDetection]) -> List[List[FaceDetection]]:
        """Group similar faces within the same chunk to avoid duplicate counting"""
        if not face_detections:
            return []

        groups = []
        used = set()

        for i, detection in enumerate(face_detections):
            if i in used:
                continue

            current_group = [detection]
            used.add(i)

            # Compare with remaining faces
            for j, other_detection in enumerate(face_detections[i+1:], i+1):
                if j in used:
                    continue

                # Calculate similarity
                distance = face_recognition.face_distance(
                    [detection.face_encoding],
                    other_detection.face_encoding
                )[0]

                # If faces are similar enough, group them
                if distance < 0.6:  # Same person threshold
                    current_group.append(other_detection)
                    used.add(j)

            groups.append(current_group)

        logger.info(f"Grouped {len(face_detections)} detections into {len(groups)} unique faces")
        return groups

    def get_best_detection_from_group(self, group: List[FaceDetection]) -> FaceDetection:
        """Get the best quality detection from a group of similar faces"""
        if len(group) == 1:
            return group[0]

        # Choose the detection with highest confidence
        return max(group, key=lambda d: d.confidence)

class FacialRecognitionService:
    def __init__(
        self,
        supabase_client: SupabaseClient,
    ):
        self.face_processor = FaceProcessor()
        self.video_chunker = VideoChunker(chunk_duration_seconds=5)
        self.supabase_client = supabase_client

    def process_profile_inputs(
        self, profile_inputs: List[ServiceProfileInput]
    ) -> Dict[str, str]:  # profile_id -> status
        """Process profile inputs to add/update face encodings from reference images"""
        processing_results = {}

        for profile_input in profile_inputs:
            try:
                # Handle both image data and image URLs
                if hasattr(profile_input, 'image_data') and profile_input.image_data:
                    image_data = profile_input.image_data
                else:
                    logger.error(f"Profile {profile_input.profile_id} has no image data or URL")
                    processing_results[profile_input.profile_id] = "error: no image data"
                    continue

                # Create face encoding from image
                face_encoding = self.face_processor.create_face_encoding_from_image(image_data)

                # Convert image to base64 for storage
                reference_image_b64 = base64.b64encode(image_data).decode('utf-8')

                # Update profile with face data
                self.supabase_client.upsert_profile_face_data(
                    profile_id=profile_input.profile_id,
                    face_encoding=face_encoding,
                    reference_image=reference_image_b64,
                )

                processing_results[profile_input.profile_id] = "success"
                logger.info(f"Processed profile {profile_input.profile_id}")

            except Exception as e:
                logger.error(f"Failed to process profile {profile_input.profile_id}: {str(e)}")
                processing_results[profile_input.profile_id] = f"error: {str(e)}"
                continue

        return processing_results

    def analyze_video(
        self,
        requester_user_id: str,
        video_url: str,
        target_profile_ids: Optional[List[str]] = None,
    ) -> Tuple[str, int, Dict[str, InteractionResult], List[Dict]]:
        """
        Main method to analyze video for facial recognition and interactions
        Returns (video_id, total_chunks, detected_profiles_dict, new_interactions_list)
        """
        video_id = str(uuid.uuid4())
        new_interactions = []

        try:
            # Step 1: Load profiles to search for
            if target_profile_ids:
                logger.info(f"Loading {len(target_profile_ids)} specific profiles")
                profiles = self.supabase_client.get_profiles_by_ids(target_profile_ids)
            else:
                logger.info("Loading all profiles with photos")
                profiles = self.supabase_client.get_all_profiles_with_photos()

            logger.info(f"Loaded {len(profiles)} profiles from database")
            # for profile in profiles:
            #     logger.info(f"Profile {profile.get('id')}: name={profile.get('name')}, has_face_encoding={bool(profile.get('face_encoding'))}, has_profile_photo={bool(profile.get('profile_photo'))}")

            # Generate face encodings for profiles that have photos but no encodings
            profile_encodings = {}
            for profile in profiles:

                # log the current line number
                logger.info(f"Current line number: 918")
                face_encoding = profile.get("face_encoding", None)
                logger.info(f"Current line number: 919")
                profile_photo = profile.get("profile_photo", None)
                logger.info(f"Current line number: 920")

                if face_encoding is not None and any(face_encoding):
                    logger.info(f"Profile {profile['id']} has face encoding")
                    profile_encodings[profile["id"]] = face_encoding
                
                elif profile_photo is not None and any(profile_photo):
                    try:
                        # Generate face encoding from profile photo
                        logger.info(f"Generating face encoding for profile {profile['id']} from profile photo")

                        profile_photo = profile["profile_photo"]
                        
                        # Remove data:image/jpeg;base64, prefix if present
                        if profile_photo.startswith("data:image/jpeg;base64,"):
                            profile_photo = profile_photo[len("data:image/jpeg;base64,"):]
                            logger.info(f"Removed data:image/jpeg;base64, prefix from profile {profile['id']}")
                        
                        logger.info(f"Decoding base64 profile_photo for {profile['id']}...")
                        # image_data = decode_image_base64_str(profile_photo.strip())
                        image_data = base64.b64decode(profile_photo.strip())
                        logger.info(f"Decoded base64 for profile {profile['id']}, size: {len(image_data)} bytes")

                        face_encoding = self.face_processor.create_face_encoding_from_image(image_data)
                        logger.info(f"Successfully created face encoding for profile {profile['id']}")

                        # Store the generated encoding in database
                        update_result = self.supabase_client.upsert_profile_face_data(
                            profile_id=profile["id"],
                            face_encoding=face_encoding
                        )
                        logger.info(f"Database update result for profile {profile['id']}: {update_result}")

                        profile_encodings[profile["id"]] = face_encoding
                        profile["face_encoding"] = face_encoding
                        logger.info(f"Added face encoding to profile_encodings for {profile['id']}")

                    except Exception as e:
                        logger.error(f"Failed to generate face encoding for profile {profile['id']}: {str(e)}")
                        logger.error(f"Profile photo starts with: {profile_photo[:50] if profile_photo else 'None'}...")
                        
                        # Add detailed base64 debugging
                        if profile_photo:
                            debug_info = debug_base64_string(profile_photo, profile['id'])
                            logger.error(f"Base64 debug info for profile {profile['id']}: {debug_info}")
                        
                        import traceback
                        logger.error(f"Full traceback: {traceback.format_exc()}")
                        continue
            profile_info = {
                profile["id"]: profile for profile in profiles
            }
            logger.info(f"Loaded {len(profile_encodings)} profiles for matching")

            # Step 2: Split video into 5-second chunks
            logger.info(f"Downloading and chunking video from {video_url}")
            chunks = self.video_chunker.split_video_from_url(video_url, video_id)
            logger.info(f"Created {len(chunks)} video chunks")

            # Step 3: Process each chunk for face detection and recognition
            chunk_results = []  # List of (chunk_index, detected_profile_ids)
            profile_face_images = defaultdict(list)  # profile_id -> [face_images]

            for chunk_id, chunk_data, chunk_index, start_time, end_time in chunks:
                logger.info(f"Processing chunk {chunk_index + 1}/{len(chunks)}")

                # Detect all faces in this chunk
                face_detections = self.face_processor.process_video_chunk_faces(chunk_data)

                # Group similar faces within the chunk to avoid duplicates
                face_groups = self.face_processor.group_faces_in_chunk(face_detections)

                # Process each unique face in the chunk
                chunk_profile_ids = set()

                for face_group in face_groups:
                    # Get the best detection from this group
                    best_detection = self.face_processor.get_best_detection_from_group(face_group)

                    # Extract face image as base64
                    face_b64 = self._extract_face_image(chunk_data, best_detection)

                    # Try to match to existing profiles
                    match_result = self.face_processor.match_face_to_profiles(
                        best_detection.face_encoding, profile_encodings
                    )

                    if match_result:
                        # Matched to existing profile
                        chunk_profile_ids.add(match_result.profile_id)
                        logger.info(f"Matched face to profile {match_result.profile_id} with confidence {match_result.confidence:.3f}")

                        # Store face image for this profile
                        if face_b64:
                            profile_face_images[match_result.profile_id].append(face_b64)

                        # Store detection for debugging
                        self.supabase_client.store_chunk_detection(
                            video_id=video_id,
                            chunk_index=chunk_index,
                            profile_id=match_result.profile_id,
                            confidence=match_result.confidence,
                            bbox={
                                "top": int(best_detection.bbox[0]),
                                "right": int(best_detection.bbox[1]),
                                "bottom": int(best_detection.bbox[2]),
                                "left": int(best_detection.bbox[3]),
                            },
                        )

                        # Add video to profile's video list
                        self.supabase_client.add_video_to_profile(match_result.profile_id, video_id)

                chunk_results.append((chunk_index, list(chunk_profile_ids)))

            # Step 4: Calculate interactions and frequency
            logger.info("Calculating interactions and frequencies")
            interaction_results = self._calculate_profile_interactions(chunk_results, profile_face_images, profile_info)

            # Step 5: Track interactions between detected profiles
            detected_profile_ids = list(interaction_results.keys())
            for i, profile_id_1 in enumerate(detected_profile_ids):
                for profile_id_2 in detected_profile_ids[i + 1:]:
                    # Calculate how many chunks they appeared together in
                    shared_chunks = interaction_results[profile_id_1].interactions.get(profile_id_2, 0)

                    if shared_chunks > 0:
                        # Upsert interaction in database
                        self.supabase_client.upsert_interaction(profile_id_1, profile_id_2, shared_chunks)
                        new_interactions.append({
                            "profile_1": profile_id_1,
                            "profile_2": profile_id_2,
                            "shared_chunks": shared_chunks
                        })
                        logger.info(f"Recorded {shared_chunks} interactions between {profile_id_1} and {profile_id_2}")

            # Step 6: Store analysis results in database
            analysis_data = {
                profile_id: {
                    "profile_id": result.profile_id,
                    "profile_name": result.profile_name,
                    "profile_email": result.profile_email,
                    "chunk_appearances": result.chunk_appearances,
                    "interactions": result.interactions,
                    "face_images": result.face_images,
                }
                for profile_id, result in interaction_results.items()
            }

            logger.info(f"Analysis complete. Found {len(interaction_results)} profiles, recorded {len(new_interactions)} interactions")
            return video_id, len(chunks), interaction_results, new_interactions

        except Exception as e:
            logger.error(f"Error analyzing video: {str(e)}")
            raise

    def _extract_face_image(self, chunk_data: bytes, face_detection: FaceDetection) -> Optional[str]:
        """Extract face image from video chunk and return as base64 string"""
        try:
            frames = self.face_processor.extract_frames_from_video_chunk(chunk_data)
            if face_detection.frame_number < len(frames):
                frame = frames[face_detection.frame_number]
                top, right, bottom, left = face_detection.bbox

                # Extract face region with some padding
                padding = 30
                face_img = frame[
                    max(0, top - padding):min(frame.shape[0], bottom + padding),
                    max(0, left - padding):min(frame.shape[1], right + padding)
                ]

                # Convert to base64
                import cv2
                _, img_encoded = cv2.imencode('.jpg', cv2.cvtColor(face_img, cv2.COLOR_RGB2BGR))
                face_b64 = base64.b64encode(img_encoded.tobytes()).decode('utf-8')
                return face_b64

        except Exception as e:
            logger.error(f"Failed to extract face image: {str(e)}")
            return None

    def _calculate_profile_interactions(
        self, chunk_results: List[Tuple[int, List[str]]], profile_face_images: Dict[str, List[str]], profile_info: Dict[str, Dict]
    ) -> Dict[str, InteractionResult]:
        """Calculate interaction frequencies between profiles and include face images"""
        # Count appearances per profile
        profile_appearances = defaultdict(int)
        # Count co-appearances between profiles
        profile_interactions = defaultdict(lambda: defaultdict(int))

        for chunk_index, profile_ids in chunk_results:
            # Count appearances
            for profile_id in profile_ids:
                profile_appearances[profile_id] += 1

            # Count interactions (co-appearances in same chunk)
            for i, profile_id1 in enumerate(profile_ids):
                for profile_id2 in profile_ids[i + 1:]:
                    profile_interactions[profile_id1][profile_id2] += 1
                    profile_interactions[profile_id2][profile_id1] += 1

        # Build final results
        results = {}
        for profile_id, appearances in profile_appearances.items():
            # Limit face images to avoid response size issues (max 3 images per profile)
            face_images = profile_face_images.get(profile_id, [])[:3]

            # Get profile info
            profile = profile_info.get(profile_id, {})

            results[profile_id] = InteractionResult(
                profile_id=profile_id,
                profile_name=profile.get("name"),
                profile_email=profile.get("email", ""),
                chunk_appearances=appearances,
                interactions=dict(profile_interactions[profile_id]),
                face_images=face_images,
            )

        return results

app = modal.App("facial-recognition-api")

# Enhanced image with all required dependencies
image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg", "cmake", "build-essential")
    .pip_install(
        "boto3",
        "requests",
        "fastapi",
        "python-multipart",
        "numpy",
        "opencv-python",
        "face-recognition",
        "supabase",
        "dlib",
        "uvicorn",
        "pytest",
        "pytest-asyncio",
        "opencv-python",
    )
)

# Secrets
supabase_secret = modal.Secret.from_name(
    "supabase-credentials",
    required_keys=["SUPABASE_URL", "SUPABASE_KEY"],
)

@app.function(
    # image=modal.Image.from_id("im-S5aildNoLYgrR3Rhdfl6RC"),
    image=image,
    secrets=[supabase_secret],
    timeout=1800,  # 30 minutes for long video processing
    memory=4096,   # More memory for face processing
    min_containers=1,
)
@modal.asgi_app()
def fastapi_app():
    web_app = FastAPI(title="Facial Recognition API", version="1.0.0")

    # Initialize services
    supabase_client = SupabaseClient(
        supabase_url=os.environ["SUPABASE_URL"],
        supabase_key=os.environ["SUPABASE_KEY"],
    )

    facial_recognition_service = FacialRecognitionService(
        supabase_client=supabase_client,
    )

    @web_app.post("/analyze-video", response_model=AnalyzeVideoResponse)
    async def analyze_video(request: AnalyzeVideoRequest):
        """
        Analyze video for facial recognition and interactions

        Args:
            request: AnalyzeVideoRequest with requester_user_id, video_url, and optional target_profiles list
        """
        try:
            logger.info(f"Starting video analysis for user {request.requester_user_id}")
            if request.target_profiles:
                logger.info(f"Targeting {len(request.target_profiles)} specific profiles")
            else:
                logger.info("Searching against all profiles with face data")

            # Analyze video
            video_id, total_chunks, results, new_interactions = facial_recognition_service.analyze_video(
                requester_user_id=request.requester_user_id,
                video_url=request.video_url,
                target_profile_ids=request.target_profiles,
            )

            # Convert results to API format
            detected_profiles = {}
            for profile_id, result in results.items():
                detected_profiles[profile_id] = InteractionData(
                    profile_id=result.profile_id,
                    profile_name=result.profile_name,
                    profile_email=result.profile_email,
                    chunk_appearances=result.chunk_appearances,
                    interactions=result.interactions,
                    face_images=result.face_images,
                )

            return AnalyzeVideoResponse(
                video_id=video_id,
                requester_user_id=request.requester_user_id,
                video_url=request.video_url,
                total_chunks=total_chunks,
                detected_profiles=detected_profiles,
                new_interactions=new_interactions,
            )

        except Exception as e:
            logger.error(f"Error analyzing video: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @web_app.get("/profiles")
    async def list_profiles():
        """List all profiles from Supabase"""
        try:
            url = "https://ndojkhkubndmfdgifnhy.supabase.co/rest/v1/profiles_images?select=id%2Cname%2Cemail%2Cprofile_photo&apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kb2praGt1Ym5kbWZkZ2lmbmh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc5NzkyNiwiZXhwIjoyMDczMzczOTI2fQ.ham5FFwZThvvJM0aLzqgoUiCoT7h2bkOI3gmu5YBZtU"

            response = requests.get(url)
            response.raise_for_status()

            return response.json()

        except Exception as e:
            logger.error(f"Error fetching profiles: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @web_app.post("/profile/{profile_id}/add-face-data")
    async def add_face_data_to_profile(profile_id: str, request: AddFaceDataRequest):
        """Add face encoding to a profile from base64 image data"""
        try:
            # Decode base64 image data into bytes
            # image_bytes = decode_image_base64_str(request.image_data.strip())
            image_data = request.image_data.strip()
            if request.image_data.startswith("data:image/jpeg;base64,"):
                image_data = image_data[len("data:image/jpeg;base64,"):]
            image_bytes = base64.b64decode(image_data)
            profile_input = ServiceProfileInput(profile_id=profile_id, image_data=image_bytes)

            result = facial_recognition_service.process_profile_inputs([profile_input])

            return {
                "profile_id": profile_id,
                "status": result.get(profile_id, "error"),
                "message": f"Face data processing {'successful' if result.get(profile_id) == 'success' else 'failed'}"
            }

        except Exception as e:
            logger.error(f"Error adding face data to profile: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @web_app.get("/interactions/{user_id}")
    async def get_user_interactions(user_id: str):
        """Get all interactions for a specific user"""
        try:
            # Use the database function to get interactions
            result = supabase_client.client.rpc("get_user_interactions", {"uid": user_id}).execute()

            return {
                "user_id": user_id,
                "interactions": result.data or []
            }

        except Exception as e:
            logger.error(f"Error getting user interactions: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @web_app.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {
            "status": "healthy",
            "service": "facial-recognition-api",
            "version": "1.0.0",
        }
    
    @web_app.get("/test-base64")
    async def test_base64_endpoint():
        """Test endpoint to validate base64 decoding functionality"""
        try:
            success = test_base64_decode()
            return {
                "test_result": "success" if success else "failed",
                "message": "Base64 decoding test completed"
            }
        except Exception as e:
            return {
                "test_result": "failed",
                "error": str(e)
            }

    return web_app


@app.local_entrypoint()
def main():
    print("Facial Recognition API deployed!")
    print("\nEndpoints:")
    print("  POST /analyze-video - Analyze video against profiles database")
    print("  GET /analysis/{video_id}?requester_user_id={user_id} - Get stored analysis")
    print("  GET /profiles - List all profiles with face data")
    print("  POST /profile/{profile_id}/add-face-data - Add face encoding to profile")
    print("  GET /interactions/{user_id} - Get user interactions")
    print("  GET /health - Health check")
    print("  GET /test-base64 - Test base64 decoding functionality")
    print("\nExample usage:")
    print("  curl -X POST {url}/analyze-video \\")
    print("    -H 'Content-Type: application/json' \\")
    print("    -d '{")
    print("      \"requester_user_id\": \"user123\",")
    print("      \"video_url\": \"https://storage.googleapis.com/bucket/video.mp4\",")
    print("      \"target_profiles\": [\"profile1\", \"profile2\"] // optional")
    print("    }'")
    print("")
    print("  curl -X POST {url}/profile/profile123/add-face-data \\")
    print("    -H 'Content-Type: application/json' \\")
    print("    -d '{")
    print("      \"image_data\": \"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...\"")
    print("    }'")
    print("")
    print("  curl {url}/interactions/user123")