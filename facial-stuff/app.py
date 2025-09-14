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

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
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
            url = f"{os.environ['SUPABASE_URL']}/rest/v1/profiles_images?id=eq.{profile_id}"
            headers = {
                "apikey": os.environ["SUPABASE_SERVICE_KEY"],
                "Authorization": f"Bearer {os.environ['SUPABASE_SERVICE_KEY']}",
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
            url = f"{os.environ['SUPABASE_URL']}/rest/v1/profiles_images?select=id%2Cname%2Cemail%2Cface_encoding%2Cprofile_photo%2Creference_image%2Cvideo_ids&apikey={os.environ['SUPABASE_SERVICE_KEY']}"

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
        face_match_threshold: float = 0.4,  # More lenient threshold (distance ≤ 0.6)
        new_contact_threshold: float = 0.3,
        frame_skip: int = 2,  # Process every 2nd frame (was 3)
        detection_scale: float = 0.75,  # Higher resolution for better detection (was 0.5)
        face_grouping_threshold: float = 0.4,  # Stricter threshold for grouping faces within chunk
        min_face_size: int = 30,  # Minimum face size in pixels
        num_jitters: int = 1,  # Number of times to resample face when generating encoding
    ):
        self.face_match_threshold = face_match_threshold
        self.new_contact_threshold = new_contact_threshold
        self.frame_skip = frame_skip
        self.detection_scale = detection_scale
        self.face_grouping_threshold = face_grouping_threshold
        self.min_face_size = min_face_size
        self.num_jitters = num_jitters
        
        # Log threshold information
        logger.info(f"🎯 Face processing configuration:")
        logger.info(f"   Match threshold: {self.face_match_threshold:.3f} (max distance: {1.0 - self.face_match_threshold:.3f})")
        logger.info(f"   Grouping threshold: {self.face_grouping_threshold:.3f} (max distance: {1.0 - self.face_grouping_threshold:.3f})")
        logger.info(f"   Frame skip: {self.frame_skip} (process every {self.frame_skip}th frame)")
        logger.info(f"   Detection scale: {self.detection_scale:.2f}")
        logger.info(f"   Min face size: {self.min_face_size}px")
        logger.info(f"   Num jitters: {self.num_jitters}")

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
            if frame is None or frame.size == 0:
                logger.warning(f"Empty frame {frame_number}, skipping")
                return []
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
            # Use more accurate detection with better parameters
            face_locations = face_recognition.face_locations(
                detection_frame,
                model="hog",  # "cnn" for better accuracy but slower
                number_of_times_to_upsample=1  # Better for smaller faces
            )

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
                face_encodings = face_recognition.face_encodings(
                    frame,
                    scaled_locations,
                    num_jitters=self.num_jitters
                )
                face_locations = scaled_locations
            else:
                face_encodings = face_recognition.face_encodings(
                    detection_frame,
                    face_locations,
                    num_jitters=self.num_jitters
                )

            detections = []
            for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
                # Calculate face dimensions
                face_width = right - left
                face_height = bottom - top
                face_area = face_width * face_height

                # Filter out faces that are too small
                if face_width < self.min_face_size or face_height < self.min_face_size:
                    continue

                # Improved confidence calculation
                # Consider both face size and aspect ratio
                aspect_ratio = face_width / face_height if face_height > 0 else 0
                aspect_penalty = abs(aspect_ratio - 1.0)  # Faces should be roughly square

                # Size-based confidence (normalize by detection scale)
                size_confidence = min(1.0, face_area / (3000 / (self.detection_scale ** 2)))

                # Aspect ratio penalty (good faces have aspect ratio near 1.0)
                aspect_confidence = max(0.0, 1.0 - aspect_penalty)

                # Combined confidence
                confidence = (size_confidence * 0.7) + (aspect_confidence * 0.3)
                confidence = max(0.1, min(1.0, confidence))  # Clamp between 0.1 and 1.0

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

        if not frames:
            logger.warning("No frames extracted from video chunk")
            return []

        # Process only every Nth frame for speed optimization
        selected_frames = frames[::self.frame_skip]
        logger.info(f"Processing {len(selected_frames)}/{len(frames)} frames (skip={self.frame_skip})")

        # Track detection quality for adaptive processing
        detection_count = 0
        low_quality_frames = 0

        for i, frame in enumerate(selected_frames):
            # Calculate the actual frame number in the original sequence
            actual_frame_number = i * self.frame_skip
            detections = self.detect_faces_in_frame(frame, actual_frame_number)

            # Track detection quality
            if detections:
                detection_count += len(detections)
                avg_confidence = sum(d.confidence for d in detections) / len(detections)
                if avg_confidence < 0.5:
                    low_quality_frames += 1

            all_detections.extend(detections)

        # Log detection statistics
        logger.info(f"Face detection statistics:")
        logger.info(f"  Total detections: {len(all_detections)}")
        logger.info(f"  Frames processed: {len(selected_frames)}/{len(frames)}")
        logger.info(f"  Avg detections per frame: {detection_count/len(selected_frames):.2f}" if selected_frames else 0)
        logger.info(f"  Low quality frames: {low_quality_frames}/{len(selected_frames)}")

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

    def match_face_to_profiles_with_detailed_scores(
        self,
        face_encoding: np.ndarray,
        profile_encodings: Dict[str, np.ndarray],
        chunk_index: int,
        face_index: int
    ) -> Optional[MatchResult]:
        """Match a face encoding to existing profiles with detailed confidence logging"""
        if not profile_encodings:
            logger.info(f"Chunk {chunk_index}, Face {face_index}: No profiles to match against")
            return None

        profile_ids = list(profile_encodings.keys())
        known_encodings = list(profile_encodings.values())

        # Calculate distances to all known faces
        distances = face_recognition.face_distance(known_encodings, face_encoding)

        logger.info(f"\n{'='*60}")
        logger.info(f"CHUNK {chunk_index}, FACE {face_index} - CONFIDENCE SCORES:")
        logger.info(f"{'='*60}")
        
        # Calculate and log confidence scores for ALL profiles
        all_scores = []
        for i, (profile_id, distance) in enumerate(zip(profile_ids, distances)):
            confidence = 1.0 - distance
            all_scores.append((profile_id, confidence, distance))
            
            # Add interpretation based on standard thresholds
            if distance <= 0.4:
                interpretation = "🟢 Excellent match"
            elif distance <= 0.6:
                interpretation = "🟡 Good match (standard threshold)"
            elif distance <= 0.8:
                interpretation = "🟠 Possible match (borderline)"
            else:
                interpretation = "🔴 Poor match"
                
            logger.info(f"Profile {profile_id}: Confidence = {confidence:.4f} (Distance = {distance:.4f}) - {interpretation}")
        
        # Sort by confidence (highest first)
        all_scores.sort(key=lambda x: x[1], reverse=True)
        
        logger.info(f"\nTOP 5 MATCHES (sorted by confidence):")
        for i, (profile_id, confidence, distance) in enumerate(all_scores[:5]):
            status = "✓ MATCH" if confidence >= self.face_match_threshold else "✗ below threshold"
            standard_match = "✓ Standard" if distance <= 0.6 else "✗ Above 0.6"
            logger.info(f"  {i+1}. Profile {profile_id}: {confidence:.4f} (dist:{distance:.4f}) [{status}] [{standard_match}]")
        
        logger.info(f"\n📊 THRESHOLD INFO:")
        logger.info(f"   Current threshold: {self.face_match_threshold:.3f} (max distance: {1.0-self.face_match_threshold:.3f})")
        logger.info(f"   Standard recommendation: 0.4 (max distance: 0.6)")
        logger.info(f"   Interpretation: Lower distance = higher similarity")
        logger.info(f"{'='*60}\n")

        # Find the best match
        min_distance_idx = np.argmin(distances)
        min_distance = distances[min_distance_idx]
        best_confidence = 1.0 - min_distance

        if best_confidence >= self.face_match_threshold:
            return MatchResult(
                profile_id=profile_ids[min_distance_idx],
                confidence=best_confidence,
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

                # Find face locations first to ensure we're getting good quality faces
                face_locations = face_recognition.face_locations(
                    image,
                    model="hog",
                    number_of_times_to_upsample=1
                )

                if not face_locations:
                    raise ValueError("No face found in the uploaded image")

                # Generate face encodings with better parameters
                encodings = face_recognition.face_encodings(
                    image,
                    face_locations,
                    num_jitters=2  # More jitters for profile photos = better accuracy
                )

                if not encodings:
                    raise ValueError("Could not generate face encoding from detected face")

                if len(encodings) > 1:
                    # If multiple faces, choose the largest one (likely the main subject)
                    largest_face_idx = 0
                    largest_area = 0

                    for i, (top, right, bottom, left) in enumerate(face_locations):
                        area = (right - left) * (bottom - top)
                        if area > largest_area:
                            largest_area = area
                            largest_face_idx = i

                    logger.warning(f"Multiple faces found in image, using largest face (face {largest_face_idx + 1}/{len(encodings)})")
                    return encodings[largest_face_idx]

                return encodings[0]

            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)

    def group_faces_in_chunk(self, face_detections: List[FaceDetection]) -> List[List[FaceDetection]]:
        """Group similar faces within the same chunk to avoid duplicate counting"""
        if not face_detections:
            return []

        # Sort detections by confidence (highest first) to prioritize better detections
        sorted_detections = sorted(face_detections, key=lambda x: x.confidence, reverse=True)

        groups = []
        used = set()

        for i, detection in enumerate(sorted_detections):
            if id(detection) in used:
                continue

            current_group = [detection]
            used.add(id(detection))

            # Compare with remaining faces
            for j, other_detection in enumerate(sorted_detections[i+1:], i+1):
                if id(other_detection) in used:
                    continue

                # Calculate similarity
                distance = face_recognition.face_distance(
                    [detection.face_encoding],
                    other_detection.face_encoding
                )[0]

                # If faces are similar enough, group them
                # Use stricter threshold to avoid merging different people
                if distance < self.face_grouping_threshold:  # Same person threshold (0.4)
                    current_group.append(other_detection)
                    used.add(id(other_detection))

            groups.append(current_group)

        # Log detailed grouping information
        logger.info(f"Face grouping results:")
        logger.info(f"  Input: {len(face_detections)} detections")
        logger.info(f"  Output: {len(groups)} unique faces")
        logger.info(f"  Grouping threshold: {self.face_grouping_threshold}")

        # Log each group's size for debugging
        for i, group in enumerate(groups):
            confidence_range = f"{min(d.confidence for d in group):.3f}-{max(d.confidence for d in group):.3f}"
            logger.info(f"  Group {i+1}: {len(group)} faces (confidence: {confidence_range})")

        return groups

    def get_best_detection_from_group(self, group: List[FaceDetection]) -> FaceDetection:
        """Get the best quality detection from a group of similar faces"""
        if len(group) == 1:
            return group[0]

        # Choose the detection with highest confidence
        return max(group, key=lambda d: d.confidence)

    def analyze_face_clustering_quality(self, face_detections: List[FaceDetection], groups: List[List[FaceDetection]]) -> Dict[str, float]:
        """Analyze the quality of face clustering for debugging purposes"""
        if not face_detections or not groups:
            return {}

        total_detections = len(face_detections)
        total_groups = len(groups)

        # Calculate group size statistics
        group_sizes = [len(group) for group in groups]
        avg_group_size = sum(group_sizes) / len(group_sizes)
        max_group_size = max(group_sizes)

        # Calculate confidence statistics
        all_confidences = [d.confidence for d in face_detections]
        avg_confidence = sum(all_confidences) / len(all_confidences)
        min_confidence = min(all_confidences)
        max_confidence = max(all_confidences)

        # Calculate inter-group distances (how different are the groups?)
        inter_group_distances = []
        for i, group1 in enumerate(groups):
            best1 = self.get_best_detection_from_group(group1)
            for j, group2 in enumerate(groups[i+1:], i+1):
                best2 = self.get_best_detection_from_group(group2)
                distance = face_recognition.face_distance(
                    [best1.face_encoding],
                    best2.face_encoding
                )[0]
                inter_group_distances.append(distance)

        avg_inter_group_distance = sum(inter_group_distances) / len(inter_group_distances) if inter_group_distances else 0
        min_inter_group_distance = min(inter_group_distances) if inter_group_distances else 0

        stats = {
            "total_detections": total_detections,
            "total_groups": total_groups,
            "avg_group_size": avg_group_size,
            "max_group_size": max_group_size,
            "avg_confidence": avg_confidence,
            "min_confidence": min_confidence,
            "max_confidence": max_confidence,
            "avg_inter_group_distance": avg_inter_group_distance,
            "min_inter_group_distance": min_inter_group_distance,
            "grouping_efficiency": total_groups / total_detections if total_detections > 0 else 0
        }

        return stats

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
            if profile_encodings:
                logger.info(f"🔍 Profile IDs available for matching: {list(profile_encodings.keys())}")
            else:
                logger.warning("⚠️ No profiles with face encodings found - cannot perform facial recognition")

            # Step 2: Split video into 5-second chunks
            logger.info(f"Downloading and chunking video from {video_url}")
            chunks = self.video_chunker.split_video_from_url(video_url, video_id)
            logger.info(f"Created {len(chunks)} video chunks")

            # Step 3: Process each chunk for face detection and recognition
            chunk_results = []  # List of (chunk_index, detected_profile_ids)
            profile_face_images = defaultdict(list)  # profile_id -> [face_images]

            for chunk_id, chunk_data, chunk_index, start_time, end_time in chunks:
                logger.info(f"\n🎬 Processing chunk {chunk_index + 1}/{len(chunks)} (Time: {start_time:.1f}s - {end_time:.1f}s)")
                logger.info(f"📊 Searching against {len(profile_encodings)} profiles with face encodings")

                # Detect all faces in this chunk
                face_detections = self.face_processor.process_video_chunk_faces(chunk_data)

                # Group similar faces within the chunk to avoid duplicates
                face_groups = self.face_processor.group_faces_in_chunk(face_detections)

                # Analyze clustering quality for debugging
                if face_detections and face_groups:
                    clustering_stats = self.face_processor.analyze_face_clustering_quality(face_detections, face_groups)
                    logger.info(f"  📈 Clustering stats: groups={clustering_stats.get('total_groups', 0)}, "
                               f"efficiency={clustering_stats.get('grouping_efficiency', 0):.2f}, "
                               f"avg_inter_distance={clustering_stats.get('avg_inter_group_distance', 0):.3f}")

                # Process each unique face in the chunk
                chunk_profile_ids = set()

                for face_group_index, face_group in enumerate(face_groups):
                    # Get the best detection from this group
                    best_detection = self.face_processor.get_best_detection_from_group(face_group)

                    # Extract face image as base64
                    face_b64 = self._extract_face_image(chunk_data, best_detection)

                    # Try to match to existing profiles with detailed confidence logging
                    match_result = self.face_processor.match_face_to_profiles_with_detailed_scores(
                        best_detection.face_encoding, profile_encodings, chunk_index, face_group_index
                    )

                    if match_result:
                        # Matched to existing profile
                        chunk_profile_ids.add(match_result.profile_id)
                        logger.info(f"Matched face to profile {match_result.profile_id} with confidence {match_result.confidence:.3f}")

                        # Store face image for this profile
                        if face_b64:
                            profile_face_images[match_result.profile_id].append(face_b64)

                        # Add video to profile's video list
                        self.supabase_client.add_video_to_profile(match_result.profile_id, video_id)

                # Log chunk summary
                logger.info(f"\n📝 CHUNK {chunk_index} SUMMARY:")
                logger.info(f"   👥 Detected {len(face_groups)} unique faces")
                logger.info(f"   ✅ Matched {len(chunk_profile_ids)} profiles: {list(chunk_profile_ids)}")
                logger.info(f"   ⏱️  Processing time: {start_time:.1f}s - {end_time:.1f}s\n")

                chunk_results.append((chunk_index, list(chunk_profile_ids)))

            # Step 4: Calculate interactions and frequency
            logger.info("Calculating interactions and frequencies")
            interaction_results = self._calculate_profile_interactions(chunk_results, profile_face_images, profile_info)

            # Step 5: Track interactions between detected profiles AND with requester
            detected_profile_ids = list(interaction_results.keys())

            # First, create interactions between requester and all detected profiles
            # (The requester uploaded the video, so they interacted with everyone in it)
            for detected_profile_id in detected_profile_ids:
                if detected_profile_id != requester_user_id:  # Don't create self-interaction
                    # Get the total chunks this profile appeared in as interaction strength
                    profile_chunks = interaction_results[detected_profile_id].chunk_appearances

                    # Upsert interaction between requester and detected profile
                    self.supabase_client.upsert_interaction(requester_user_id, detected_profile_id, profile_chunks)
                    new_interactions.append({
                        "profile_1": requester_user_id,
                        "profile_2": detected_profile_id,
                        "shared_chunks": profile_chunks,
                        "interaction_type": "requester_with_detected"
                    })
                    logger.info(f"Recorded {profile_chunks} interactions between requester {requester_user_id} and detected profile {detected_profile_id}")

            # Then, track interactions between detected profiles (existing logic)
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
                            "shared_chunks": shared_chunks,
                            "interaction_type": "detected_with_detected"
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

            # Count different types of interactions for logging
            requester_interactions = len([i for i in new_interactions if i.get("interaction_type") == "requester_with_detected"])
            profile_interactions = len([i for i in new_interactions if i.get("interaction_type") == "detected_with_detected"])

            logger.info(f"Analysis complete. Found {len(interaction_results)} profiles, recorded {len(new_interactions)} total interactions")
            logger.info(f"  - {requester_interactions} interactions between requester and detected profiles")
            logger.info(f"  - {profile_interactions} interactions between detected profiles")
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
    required_keys=["SUPABASE_URL", "SUPABASE_KEY", "SUPABASE_SERVICE_KEY"],
)

@app.function(
    # image=modal.Image.from_id("im-S5aildNoLYgrR3Rhdfl6RC"),
    image=image,
    secrets=[supabase_secret],
    timeout=1800,  # 30 minutes for long video processing
    memory=8192,   # Increased memory for better face processing (8GB)
    cpu=4,         # Multiple CPU cores for parallel processing
    min_containers=1,
    max_containers=4,  # Allow scaling for concurrent requests
    scaledown_window=300,  # Keep containers warm for 5 minutes
)
@modal.asgi_app()
def fastapi_app():
    web_app = FastAPI(title="Facial Recognition API", version="1.0.0")

    # Add CORS middleware to allow all origins
    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allows all origins
        allow_credentials=True,
        allow_methods=["*"],  # Allows all methods
        allow_headers=["*"],  # Allows all headers
    )

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
            url = f"{os.environ['SUPABASE_URL']}/rest/v1/profiles_images?select=id%2Cname%2Cemail%2Cprofile_photo&apikey={os.environ['SUPABASE_SERVICE_KEY']}"

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

    @web_app.get("/interactions")
    async def get_all_interactions(user_id: Optional[str] = Query(None, description="Filter interactions for a specific user")):
        """Get interactions with full profile details for both users. Optionally filter by user_id."""
        try:
            if user_id:
                logger.info(f"Fetching interactions for user {user_id} with profile details")
            else:
                logger.info("Fetching all interactions with profile details")

            # Use direct HTTP call with PostgREST
            import requests
            base_url = f"{os.environ['SUPABASE_URL']}/rest/v1"
            headers = {
                "apikey": os.environ["SUPABASE_SERVICE_KEY"],
                "Authorization": f"Bearer {os.environ['SUPABASE_SERVICE_KEY']}",
                "Content-Type": "application/json"
            }

            # Build the interactions query with optional user filtering
            interactions_query = f"{base_url}/interactions?select=*&order=updated_at.desc"
            
            if user_id:
                # Filter interactions where user_id is in either user_id_1 or user_id_2
                # Using PostgREST's "or" filter syntax
                interactions_query += f"&or=(user_id_1.eq.{user_id},user_id_2.eq.{user_id})"

            # Get interactions (filtered or all)
            interactions_response = requests.get(interactions_query, headers=headers)
            interactions_response.raise_for_status()
            interactions_data = interactions_response.json()

            if user_id:
                logger.info(f"Retrieved {len(interactions_data)} interactions for user {user_id}")
            else:
                logger.info(f"Retrieved {len(interactions_data)} total interactions")

            if not interactions_data:
                return {
                    "total_interactions": 0,
                    "interactions": [],
                    "filtered_by_user": user_id
                }

            # Get all unique user IDs from the filtered interactions
            user_ids = set()
            for interaction in interactions_data:
                user_ids.add(interaction['user_id_1'])
                user_ids.add(interaction['user_id_2'])

            # Only fetch profiles for users that appear in the filtered interactions
            user_ids_list = list(user_ids)
            if user_ids_list:
                # Build query to fetch only the needed profiles
                profiles_query = f"{base_url}/profiles_images?select=id,name,email,profile_photo,reference_image,video_ids"
                # Use PostgREST's "in" filter to get only the profiles we need
                user_ids_param = ",".join(user_ids_list)
                profiles_query += f"&id=in.({user_ids_param})"
                
                profiles_response = requests.get(profiles_query, headers=headers)
                profiles_response.raise_for_status()
                profiles_data = profiles_response.json()
                
                logger.info(f"Retrieved {len(profiles_data)} profiles for {len(user_ids_list)} unique users")
            else:
                profiles_data = []

            # Create a lookup dictionary for profiles
            profiles_lookup = {profile['id']: profile for profile in profiles_data}

            # Build the final result with joined data
            enriched_interactions = []
            for interaction in interactions_data:
                user1_id = interaction['user_id_1']
                user2_id = interaction['user_id_2']

                user1_profile = profiles_lookup.get(user1_id, {})
                user2_profile = profiles_lookup.get(user2_id, {})

                enriched_interaction = {
                    "id": interaction['id'],
                    "interaction_count": interaction['interaction_count'],
                    "created_at": interaction['created_at'],
                    "updated_at": interaction['updated_at'],
                    "user1": {
                        "id": user1_id,
                        "name": user1_profile.get('name'),
                        "email": user1_profile.get('email'),
                        "profile_photo": user1_profile.get('profile_photo'),
                        "reference_image": user1_profile.get('reference_image'),
                        "video_ids": user1_profile.get('video_ids', [])
                    },
                    "user2": {
                        "id": user2_id,
                        "name": user2_profile.get('name'),
                        "email": user2_profile.get('email'),
                        "profile_photo": user2_profile.get('profile_photo'),
                        "reference_image": user2_profile.get('reference_image'),
                        "video_ids": user2_profile.get('video_ids', [])
                    }
                }
                enriched_interactions.append(enriched_interaction)

            logger.info(f"Successfully enriched {len(enriched_interactions)} interactions with profile data")

            result = {
                "total_interactions": len(enriched_interactions),
                "interactions": enriched_interactions
            }
            
            # Add filter information to response
            if user_id:
                result["filtered_by_user"] = user_id
                
            return result

        except Exception as e:
            logger.error(f"Error fetching interactions: {str(e)}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
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
    print("  GET /interactions?user_id={user_id} - Get interactions with profile details, optionally filtered by user")
    print("  GET /interactions - Get all interactions with profile details")
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
    print("  curl '{url}/interactions?user_id=user123'  # Get interactions for specific user with full profile details")
    print("  curl {url}/interactions  # Get all interactions with full profile details")