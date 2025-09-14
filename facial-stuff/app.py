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
from typing import List, Optional, Dict, Tuple, BinaryIO
from datetime import datetime
from collections import defaultdict
from dataclasses import dataclass

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic models (schemas)
class ContactInput(BaseModel):
    uuid: str
    image_url: Optional[str] = None  # Google Cloud Storage URL
    name: Optional[str] = None

class AnalyzeVideoRequest(BaseModel):
    user_id: str
    video_url: str
    contacts: Optional[List[ContactInput]] = None

class InteractionData(BaseModel):
    chunk_appearances: int
    interactions: Dict[str, int]  # contact_id -> number of shared chunks
    face_images: List[str] = []  # base64 encoded face images

class AnalyzeVideoResponse(BaseModel):
    video_id: str
    user_id: str
    video_url: str
    total_chunks: int
    results: Dict[str, InteractionData]  # contact_id -> interaction data

class GetAnalysisRequest(BaseModel):
    user_id: str
    video_id: str

class GetAnalysisResponse(BaseModel):
    video_id: str
    user_id: str
    video_url: str
    total_chunks: int
    results: Dict[str, InteractionData]
    created_at: datetime

class Contact(BaseModel):
    id: str
    user_id: str
    name: Optional[str]
    image_url: str
    created_at: datetime
    updated_at: datetime

class ListContactsResponse(BaseModel):
    user_id: str
    contacts: List[Contact]

# Data classes for internal processing
@dataclass
class ServiceContactInput:
    uuid: str
    image_data: Optional[bytes] = None
    image_url: Optional[str] = None
    name: Optional[str] = None

@dataclass
class FaceDetection:
    face_encoding: np.ndarray
    bbox: Tuple[int, int, int, int]  # top, right, bottom, left
    confidence: float
    frame_number: int

@dataclass
class MatchResult:
    contact_id: str
    confidence: float
    is_new_contact: bool

@dataclass
class InteractionResult:
    contact_id: str
    chunk_appearances: int
    interactions: Dict[str, int]  # contact_id -> number of shared chunks
    face_images: List[str] = None  # base64 encoded face images

    def __post_init__(self):
        if self.face_images is None:
            self.face_images = []

# Services classes
class SupabaseClient:
    def __init__(self, supabase_url: str, supabase_key: str):
        self.client: Client = create_client(supabase_url, supabase_key)

    def upsert_contact(
        self,
        user_id: str,
        contact_uuid: str,
        face_encoding: np.ndarray,
        image_url: str,
        name: Optional[str] = None,
    ) -> Dict:
        """Upsert a contact with face encoding"""
        try:
            # Serialize the face encoding and encode as base64 for JSON compatibility
            encoding_bytes = pickle.dumps(face_encoding)
            encoding_b64 = base64.b64encode(encoding_bytes).decode('utf-8')

            contact_data = {
                "id": contact_uuid,
                "user_id": user_id,
                "name": name,
                "face_encoding": encoding_b64,
                "image_url": image_url,
                "updated_at": datetime.now().isoformat(),
            }

            result = (
                self.client.table("contacts")
                .upsert(contact_data)
                .execute()
            )

            logger.info(f"Upserted contact {contact_uuid} for user {user_id}")
            return result.data[0] if result.data else {}

        except Exception as e:
            logger.error(f"Error upserting contact: {str(e)}")
            raise

    def get_user_contacts(self, user_id: str) -> List[Dict]:
        """Get all contacts for a user with their face encodings"""
        try:
            result = (
                self.client.table("contacts")
                .select("id, user_id, name, face_encoding, image_url")
                .eq("user_id", user_id)
                .execute()
            )

            contacts = []
            for contact in result.data:
                # Deserialize face encoding from base64
                encoding_b64 = contact["face_encoding"]
                encoding_bytes = base64.b64decode(encoding_b64.encode('utf-8'))
                face_encoding = pickle.loads(encoding_bytes)
                contact["face_encoding"] = face_encoding
                contacts.append(contact)

            logger.info(f"Retrieved {len(contacts)} contacts for user {user_id}")
            return contacts

        except Exception as e:
            logger.error(f"Error retrieving contacts: {str(e)}")
            raise

    def store_video_analysis(
        self,
        user_id: str,
        video_id: str,
        video_url: str,
        total_chunks: int,
        analysis_results: Dict,
    ) -> Dict:
        """Store video analysis results"""
        try:
            analysis_data = {
                "user_id": user_id,
                "video_id": video_id,
                "video_url": video_url,
                "total_chunks": total_chunks,
                "analysis_results": analysis_results,
            }

            result = (
                self.client.table("video_analyses")
                .insert(analysis_data)
                .execute()
            )

            logger.info(f"Stored analysis for video {video_id}")
            return result.data[0] if result.data else {}

        except Exception as e:
            logger.error(f"Error storing video analysis: {str(e)}")
            raise

    def get_video_analysis(self, user_id: str, video_id: str) -> Optional[Dict]:
        """Get video analysis results"""
        try:
            result = (
                self.client.table("video_analyses")
                .select("*")
                .eq("user_id", user_id)
                .eq("video_id", video_id)
                .execute()
            )

            return result.data[0] if result.data else None

        except Exception as e:
            logger.error(f"Error retrieving video analysis: {str(e)}")
            raise

    def store_chunk_detection(
        self,
        video_id: str,
        chunk_index: int,
        contact_id: str,
        confidence: float,
        bbox: Optional[Dict] = None,
    ) -> Dict:
        """Store individual chunk detection for debugging"""
        try:
            detection_data = {
                "video_id": video_id,
                "chunk_index": chunk_index,
                "contact_id": contact_id,
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

    def match_face_to_contacts(
        self,
        face_encoding: np.ndarray,
        contact_encodings: Dict[str, np.ndarray]
    ) -> Optional[MatchResult]:
        """Match a face encoding to existing contacts"""
        if not contact_encodings:
            return None

        contact_ids = list(contact_encodings.keys())
        known_encodings = list(contact_encodings.values())

        # Calculate distances to all known faces
        distances = face_recognition.face_distance(known_encodings, face_encoding)

        # Find the best match
        min_distance_idx = np.argmin(distances)
        min_distance = distances[min_distance_idx]

        # Convert distance to confidence (lower distance = higher confidence)
        confidence = 1.0 - min_distance

        if confidence >= self.face_match_threshold:
            return MatchResult(
                contact_id=contact_ids[min_distance_idx],
                confidence=confidence,
                is_new_contact=False
            )

        return None

    def create_contact_from_image(self, image_data: bytes) -> Tuple[str, np.ndarray]:
        """Create a new contact from an uploaded image"""
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

                contact_id = str(uuid.uuid4())
                return contact_id, encodings[0]

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

    def download_image_from_url(self, image_url: str) -> bytes:
        """Download image from Google Cloud Storage URL"""
        try:
            import requests
            response = requests.get(image_url)
            response.raise_for_status()
            return response.content
        except Exception as e:
            logger.error(f"Failed to download image from {image_url}: {str(e)}")
            raise

    def process_contact_inputs(
        self, user_id: str, contact_inputs: List[ServiceContactInput]
    ) -> Dict[str, Tuple[str, str]]:  # contact_uuid -> (contact_id, image_url)
        """Process contact inputs (either image data or image URLs), return mapping of input UUIDs to stored contact info"""
        contact_mapping = {}

        for contact_input in contact_inputs:
            try:
                # Handle both image data and image URLs
                if hasattr(contact_input, 'image_data') and contact_input.image_data:
                    # Direct image data provided
                    image_data = contact_input.image_data
                    image_url = None  # Will be set by caller if needed
                elif hasattr(contact_input, 'image_url') and contact_input.image_url:
                    # Image URL provided - download it
                    image_data = self.download_image_from_url(contact_input.image_url)
                    image_url = contact_input.image_url
                else:
                    logger.error(f"Contact {contact_input.uuid} has no image data or URL")
                    continue

                # Create face encoding from image
                contact_id, face_encoding = self.face_processor.create_contact_from_image(image_data)

                # Store contact in Supabase
                self.supabase_client.upsert_contact(
                    user_id=user_id,
                    contact_uuid=contact_input.uuid,
                    face_encoding=face_encoding,
                    image_url=image_url or f"placeholder_for_{contact_input.uuid}",
                    name=contact_input.name,
                )

                contact_mapping[contact_input.uuid] = (contact_input.uuid, image_url or f"processed_{contact_input.uuid}")
                logger.info(f"Processed contact {contact_input.uuid}")

            except Exception as e:
                logger.error(f"Failed to process contact {contact_input.uuid}: {str(e)}")
                # Continue processing other contacts
                continue

        return contact_mapping

    def analyze_video(
        self,
        user_id: str,
        video_url: str,
        contact_inputs: Optional[List[ServiceContactInput]] = None,
    ) -> Tuple[str, int, Dict[str, InteractionResult]]:
        """
        Main method to analyze video for facial recognition and interactions
        Returns (video_id, total_chunks, results_dict) where results_dict has contact UUIDs as keys and interaction data as values
        """
        video_id = str(uuid.uuid4())

        try:
            # Step 1: Process any new contact inputs
            if contact_inputs:
                logger.info(f"Processing {len(contact_inputs)} contact inputs")
                self.process_contact_inputs(user_id, contact_inputs)

            # Step 2: Load existing contacts from database
            logger.info("Loading existing contacts from database")
            existing_contacts = self.supabase_client.get_user_contacts(user_id)
            contact_encodings = {
                contact["id"]: contact["face_encoding"] for contact in existing_contacts
            }
            logger.info(f"Loaded {len(contact_encodings)} existing contacts")

            # Step 3: Split video into 5-second chunks
            logger.info(f"Downloading and chunking video from {video_url}")
            chunks = self.video_chunker.split_video_from_url(video_url, video_id)
            logger.info(f"Created {len(chunks)} video chunks")

            # Step 4: Process each chunk for face detection and recognition
            chunk_results = []  # List of (chunk_index, detected_contact_ids, face_images_dict)
            contact_face_images = defaultdict(list)  # contact_id -> [face_images]

            for chunk_id, chunk_data, chunk_index, start_time, end_time in chunks:
                logger.info(f"Processing chunk {chunk_index + 1}/{len(chunks)}")

                # Detect all faces in this chunk
                face_detections = self.face_processor.process_video_chunk_faces(chunk_data)

                # Group similar faces within the chunk to avoid duplicates
                face_groups = self.face_processor.group_faces_in_chunk(face_detections)

                # Process each unique face in the chunk
                chunk_contact_ids = set()

                for face_group in face_groups:
                    # Get the best detection from this group
                    best_detection = self.face_processor.get_best_detection_from_group(face_group)

                    # Extract face image as base64
                    face_b64 = self._extract_face_image(chunk_data, best_detection)

                    # Try to match to existing contacts
                    match_result = self.face_processor.match_face_to_contacts(
                        best_detection.face_encoding, contact_encodings
                    )

                    if match_result:
                        # Matched to existing contact
                        chunk_contact_ids.add(match_result.contact_id)
                        logger.info(f"Matched face to contact {match_result.contact_id} with confidence {match_result.confidence:.3f}")

                        # Store face image for this contact
                        if face_b64:
                            contact_face_images[match_result.contact_id].append(face_b64)

                        # Store detection for debugging
                        self.supabase_client.store_chunk_detection(
                            video_id=video_id,
                            chunk_index=chunk_index,
                            contact_id=match_result.contact_id,
                            confidence=match_result.confidence,
                            bbox={
                                "top": int(best_detection.bbox[0]),
                                "right": int(best_detection.bbox[1]),
                                "bottom": int(best_detection.bbox[2]),
                                "left": int(best_detection.bbox[3]),
                            },
                        )
                    else:
                        # Create new contact for unrecognized face
                        if best_detection.confidence >= self.face_processor.new_contact_threshold:
                            new_contact_id = str(uuid.uuid4())

                            # Store new contact in Supabase (without uploaded image for now)
                            self.supabase_client.upsert_contact(
                                user_id=user_id,
                                contact_uuid=new_contact_id,
                                face_encoding=best_detection.face_encoding,
                                image_url=f"auto_generated_{new_contact_id}",  # Placeholder URL
                                name=None,  # Auto-generated contact
                            )

                            # Add to our local contact encodings for subsequent chunks
                            contact_encodings[new_contact_id] = best_detection.face_encoding
                            chunk_contact_ids.add(new_contact_id)

                            # Store face image for this contact
                            if face_b64:
                                contact_face_images[new_contact_id].append(face_b64)

                            logger.info(f"Created new contact {new_contact_id}")

                chunk_results.append((chunk_index, list(chunk_contact_ids)))

            # Step 5: Calculate interactions and frequency
            logger.info("Calculating interactions and frequencies")
            interaction_results = self._calculate_interactions(chunk_results, contact_face_images)

            # Step 6: Store analysis results in database
            analysis_data = {
                contact_id: {
                    "chunk_appearances": result.chunk_appearances,
                    "interactions": result.interactions,
                    "face_images": result.face_images,
                }
                for contact_id, result in interaction_results.items()
            }

            self.supabase_client.store_video_analysis(
                user_id=user_id,
                video_id=video_id,
                video_url=video_url,
                total_chunks=len(chunks),
                analysis_results=analysis_data,
            )

            logger.info(f"Analysis complete. Found {len(interaction_results)} unique contacts")
            return video_id, len(chunks), interaction_results

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

    def _calculate_interactions(
        self, chunk_results: List[Tuple[int, List[str]]], contact_face_images: Dict[str, List[str]]
    ) -> Dict[str, InteractionResult]:
        """Calculate interaction frequencies between contacts and include face images"""
        # Count appearances per contact
        contact_appearances = defaultdict(int)
        # Count co-appearances between contacts
        contact_interactions = defaultdict(lambda: defaultdict(int))

        for chunk_index, contact_ids in chunk_results:
            # Count appearances
            for contact_id in contact_ids:
                contact_appearances[contact_id] += 1

            # Count interactions (co-appearances in same chunk)
            for i, contact_id1 in enumerate(contact_ids):
                for contact_id2 in contact_ids[i + 1:]:
                    contact_interactions[contact_id1][contact_id2] += 1
                    contact_interactions[contact_id2][contact_id1] += 1

        # Build final results
        results = {}
        for contact_id, appearances in contact_appearances.items():
            # Limit face images to avoid response size issues (max 3 images per contact)
            face_images = contact_face_images.get(contact_id, [])[:3]

            results[contact_id] = InteractionResult(
                contact_id=contact_id,
                chunk_appearances=appearances,
                interactions=dict(contact_interactions[contact_id]),
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
    )
)

# Secrets
supabase_secret = modal.Secret.from_name(
    "supabase-credentials",
    required_keys=["SUPABASE_URL", "SUPABASE_KEY"],
)

@app.function(
    image=modal.Image.from_id("im-S5aildNoLYgrR3Rhdfl6RC"),
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
            request: AnalyzeVideoRequest with user_id, video_url, and optional contact list with GCS URLs
        """
        try:
            # Process contact inputs if provided
            contact_inputs = []
            if request.contacts:
                for contact in request.contacts:
                    contact_inputs.append(ServiceContactInput(
                        uuid=contact.uuid,
                        image_url=contact.image_url,
                        name=contact.name,
                    ))

            logger.info(f"Starting video analysis for user {request.user_id} with {len(contact_inputs)} contacts")

            # Analyze video
            video_id, total_chunks, results = facial_recognition_service.analyze_video(
                user_id=request.user_id,
                video_url=request.video_url,
                contact_inputs=contact_inputs if contact_inputs else None,
            )

            # Convert results to API format
            interaction_data = {}
            for contact_id, result in results.items():
                interaction_data[contact_id] = InteractionData(
                    chunk_appearances=result.chunk_appearances,
                    interactions=result.interactions,
                    face_images=result.face_images,
                )

            return AnalyzeVideoResponse(
                video_id=video_id,
                user_id=request.user_id,
                video_url=request.video_url,
                total_chunks=total_chunks,
                results=interaction_data,
            )

        except Exception as e:
            logger.error(f"Error analyzing video: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))


    @web_app.get("/analysis/{video_id}", response_model=GetAnalysisResponse)
    async def get_analysis(video_id: str, user_id: str):
        """Get stored video analysis results"""
        try:
            analysis = supabase_client.get_video_analysis(user_id, video_id)

            if not analysis:
                raise HTTPException(status_code=404, detail="Analysis not found")

            # Convert stored results to API format
            interaction_data = {}
            for contact_id, result in analysis["analysis_results"].items():
                interaction_data[contact_id] = InteractionData(
                    chunk_appearances=result["chunk_appearances"],
                    interactions=result["interactions"],
                    face_images=result.get("face_images", []),
                )

            return GetAnalysisResponse(
                video_id=analysis["video_id"],
                user_id=analysis["user_id"],
                video_url=analysis["video_url"],
                total_chunks=analysis["total_chunks"],
                results=interaction_data,
                created_at=analysis["created_at"],
            )

        except Exception as e:
            logger.error(f"Error retrieving analysis: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @web_app.get("/contacts/{user_id}", response_model=ListContactsResponse)
    async def list_contacts(user_id: str):
        """List all contacts for a user"""
        try:
            contacts_data = supabase_client.get_user_contacts(user_id)

            contacts = []
            for contact_data in contacts_data:
                contacts.append(Contact(
                    id=contact_data["id"],
                    user_id=contact_data["user_id"],
                    name=contact_data["name"],
                    image_url=contact_data["image_url"],
                    created_at=contact_data.get("created_at"),
                    updated_at=contact_data.get("updated_at"),
                ))

            return ListContactsResponse(
                user_id=user_id,
                contacts=contacts,
            )

        except Exception as e:
            logger.error(f"Error listing contacts: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @web_app.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {
            "status": "healthy",
            "service": "facial-recognition-api",
            "version": "1.0.0",
        }

    return web_app


@app.local_entrypoint()
def main():
    print("Facial Recognition API deployed!")
    print("\nEndpoints:")
    print("  POST /analyze-video - Analyze video with optional contact GCS URLs")
    print("  GET /analysis/{video_id}?user_id={user_id} - Get stored analysis")
    print("  GET /contacts/{user_id} - List user contacts")
    print("  GET /health - Health check")
    print("\nExample usage:")
    print("  curl -X POST {url}/analyze-video \\")
    print("    -H 'Content-Type: application/json' \\")
    print("    -d '{")
    print("      \"user_id\": \"user123\",")
    print("      \"video_url\": \"https://storage.googleapis.com/bucket/video.mp4\",")
    print("      \"contacts\": [")
    print("        {")
    print("          \"uuid\": \"uuid1\",")
    print("          \"image_url\": \"https://storage.googleapis.com/bucket/john.jpg\",")
    print("          \"name\": \"John Doe\"")
    print("        }")
    print("      ]")
    print("    }'")