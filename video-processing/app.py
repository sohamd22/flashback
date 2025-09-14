import modal
import os
import uuid
import logging

from fastapi import FastAPI, UploadFile, File, Form, HTTPException

from services.storage import StorageService
from services.vector_db import VectorDBService
from services.video_processor import VideoProcessor
from services.vlm_service import VLMService
from services.transcription_service import TranscriptionService
from models.schemas import (
    ProcessVideoResponse,
    ProcessPhotoResponse,
    RetrieveClipsRequest,
    RetrieveClipsResponse,
    ClipWithUrl,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = modal.App("video-processing-api")

# Enhanced image with all required dependencies including ffmpeg
image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg")
    .pip_install(
        "boto3",
        "requests",
        "pinecone",
        "fastapi",
        "python-multipart",
        "numpy",
        "anthropic",
        "openai",
    )
    .add_local_python_source("services")
    .add_local_python_source("models")
    .add_local_python_source("utils")
)

# Secrets
gcs_secret = modal.Secret.from_name(
    "gcp-credentials",
    required_keys=["GCP_ACCESS_KEY_ID", "GCP_ACCESS_KEY_SECRET"],
)

pinecone_secret = modal.Secret.from_name(
    "pinecone-credentials",
    required_keys=["PINECONE_API_KEY", "PINECONE_HOST"],
)

anthropic_secret = modal.Secret.from_name(
    "anthropic-credentials",
    required_keys=["ANTHROPIC_API_KEY"],
)

openai_secret = modal.Secret.from_name(
    "openai-credentials",
    required_keys=["OPENAI_API_KEY"],
)


@app.function(
    image=image,
    secrets=[gcs_secret, pinecone_secret, anthropic_secret, openai_secret],
    timeout=600,
    min_containers=1,
)
@modal.asgi_app()
def fastapi_app():
    web_app = FastAPI(title="Video Processing API")

    # Initialize services
    storage_service = StorageService(
        access_key_id=os.environ["GCP_ACCESS_KEY_ID"],
        access_key_secret=os.environ["GCP_ACCESS_KEY_SECRET"],
    )
    vector_db_service = VectorDBService(
        api_key=os.environ["PINECONE_API_KEY"], index_host=os.environ["PINECONE_HOST"]
    )
    video_processor = VideoProcessor()
    vlm_service = VLMService(api_key=os.environ["ANTHROPIC_API_KEY"])
    transcription_service = TranscriptionService(api_key=os.environ["OPENAI_API_KEY"])

    @web_app.post("/process-photo", response_model=ProcessPhotoResponse)
    async def process_photo(user_id: str = Form(...), photo: UploadFile = File(...)):
        """Process and store a photo with AI-generated description"""
        try:
            # Read photo data
            photo_data = await photo.read()
            logger.info(
                f"Processing photo for user {user_id}, size: {len(photo_data)} bytes"
            )

            # Generate photo ID
            photo_id = str(uuid.uuid4())

            # Generate description using VLM service
            # VLM service expects video data but can process single images
            description = vlm_service.generate_description(
                video_chunk_data=photo_data,
                chunk_index=0,
                start_time=0,
                end_time=0,
                video_filename=photo.filename or "photo.jpg",
                current_transcription="",
                previous_transcription=None,
            )

            # Upload photo to GCS
            storage_service.upload_video_chunk(
                file_data=photo_data,
                user_id=user_id,
                video_id=photo_id,  # Use photo_id as video_id
                chunk_id=photo_id,
                chunk_index=0,
            )

            # Store metadata in Pinecone for searchability
            vector_db_service.upsert_video_chunk(
                chunk_id=photo_id,
                user_id=user_id,
                video_id=photo_id,
                text=description,
            )

            logger.info(f"Successfully processed photo {photo_id} for user {user_id}")

            return ProcessPhotoResponse(
                photo_id=photo_id,
                user_id=user_id,
                description=description,
                stored=True,
            )

        except Exception as e:
            logger.error(f"Error processing photo: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @web_app.post("/process-video", response_model=ProcessVideoResponse)
    async def process_video(user_id: str = Form(...), video: UploadFile = File(...)):
        """Process and store a video, splitting it into chunks"""
        try:
            # Read video data
            video_data = await video.read()
            logger.info(
                f"Processing video for user {user_id}, size: {len(video_data)} bytes"
            )

            # Validate video
            if not video_processor.validate_video(video_data):
                raise HTTPException(status_code=400, detail="Invalid video file")

            # Generate video ID
            video_id = str(uuid.uuid4())

            # Split video into chunks
            chunks = video_processor.split_video(video_data, video_id)
            chunk_ids = []

            logger.info(f"Generating transcriptions and descriptions for {len(chunks)} chunks")

            # First, transcribe all chunks
            logger.info("Transcribing video chunks...")
            transcriptions = transcription_service.transcribe_batch(chunks)

            # Process chunks with both transcription and VLM
            previous_transcription = None
            for i, (chunk_id, chunk_data, chunk_index, start_time, end_time) in enumerate(chunks):
                # Get current transcription
                current_transcription = transcriptions[i].get("text", "") if i < len(transcriptions) else ""

                # Generate natural language description with transcription context
                description = vlm_service.generate_description(
                    video_chunk_data=chunk_data,
                    chunk_index=chunk_index,
                    start_time=start_time,
                    end_time=end_time,
                    video_filename=video.filename,
                    current_transcription=current_transcription,
                    previous_transcription=previous_transcription,
                )

                # Combine description with transcription for searchability
                combined_text = description
                if current_transcription:
                    combined_text += f" [Transcription: {current_transcription}]"

                # Upload chunk to GCS
                storage_service.upload_video_chunk(
                    file_data=chunk_data,
                    user_id=user_id,
                    video_id=video_id,
                    chunk_id=chunk_id,
                    chunk_index=chunk_index,
                )

                # Store metadata in Pinecone with both description and transcription
                vector_db_service.upsert_video_chunk(
                    chunk_id=chunk_id,
                    user_id=user_id,
                    video_id=video_id,
                    text=combined_text,
                )

                chunk_ids.append(chunk_id)
                logger.info(f"Processed chunk {chunk_index + 1}/{len(chunks)}")

                # Update previous transcription for next iteration
                previous_transcription = current_transcription

            # Calculate total duration
            total_duration = chunks[-1][4] if chunks else 0

            return ProcessVideoResponse(
                video_id=video_id,
                user_id=user_id,
                chunk_ids=chunk_ids,
                total_chunks=len(chunks),
                duration_seconds=total_duration,
            )

        except Exception as e:
            logger.error(f"Error processing video: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @web_app.post("/retrieve-clips", response_model=RetrieveClipsResponse)
    async def retrieve_clips(request: RetrieveClipsRequest):
        """Retrieve relevant clips for a query with presigned URLs"""
        try:
            # Query Pinecone for relevant clips
            clips = vector_db_service.query_clips(
                query_text=request.query, user_id=request.user_id, top_k=request.top_k
            )

            # Generate presigned URLs for each clip
            clips_with_urls = []
            for clip in clips:
                # Reconstruct GCS path from metadata
                logger.info(
                    f"Getting chunk path for clip {clip['chunk_id'], clip['video_id'], request.user_id}"
                )
                gcs_path = storage_service.get_chunk_path(
                    user_id=request.user_id,
                    video_id=clip["video_id"],
                    chunk_id=clip["chunk_id"],
                )

                url, expires_at = storage_service.generate_presigned_url(gcs_path)

                clips_with_urls.append(
                    ClipWithUrl(
                        chunk_id=clip["chunk_id"],
                        score=clip["score"],
                        user_id=clip["user_id"],
                        video_id=clip["video_id"],
                        url=url,
                        expires_at=expires_at,
                    )
                )

            return RetrieveClipsResponse(
                user_id=request.user_id, query=request.query, clips=clips_with_urls
            )

        except Exception as e:
            logger.error(f"Error retrieving clips: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @web_app.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {
            "status": "healthy",
            "services": {
                "storage": "initialized",
                "vector_db": "initialized",
                "video_processor": "initialized",
                "vlm": "initialized",
                "transcription": "initialized",
            },
        }

    return web_app


@app.local_entrypoint()
def main():
    print("Video Processing API skeleton deployed!")
    print("\nEndpoints:")
    print("  POST /process-video - Upload and process a video")
    print("  POST /retrieve-clips - Search for clips with presigned URLs")
    print("  GET /health - Health check")
