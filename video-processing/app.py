import modal
import os
import uuid
import logging
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, Form, HTTPException

from services.storage import StorageService
from services.vector_db import VectorDBService
from services.video_processor import VideoProcessor
from models.schemas import (
    ProcessVideoResponse,
    RetrieveClipsRequest,
    RetrieveClipsResponse,
    GetClipRequest,
    GetClipResponse,
    VideoChunkMetadata
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


@app.function(
    image=image,
    secrets=[gcs_secret, pinecone_secret],
    timeout=600,
    min_containers=1,
)
@modal.asgi_app()
def fastapi_app():
    web_app = FastAPI(title="Video Processing API")

    # Initialize services
    storage_service = StorageService(
        access_key_id=os.environ['GCP_ACCESS_KEY_ID'],
        access_key_secret=os.environ['GCP_ACCESS_KEY_SECRET']
    )
    vector_db_service = VectorDBService(
        api_key=os.environ['PINECONE_API_KEY'],
        index_host=os.environ['PINECONE_HOST']
    )
    video_processor = VideoProcessor()

    @web_app.post("/process-video", response_model=ProcessVideoResponse)
    async def process_video(
        user_id: str = Form(...),
        video: UploadFile = File(...)
    ):
        """Process and store a video, splitting it into chunks"""
        try:
            # Read video data
            video_data = await video.read()
            logger.info(f"Processing video for user {user_id}, size: {len(video_data)} bytes")

            # Validate video
            if not video_processor.validate_video(video_data):
                raise HTTPException(status_code=400, detail="Invalid video file")

            # Generate video ID
            video_id = str(uuid.uuid4())

            # Split video into chunks
            chunks = video_processor.split_video(video_data, video_id)
            chunk_ids = []

            for chunk_id, chunk_data, chunk_index, start_time, end_time in chunks:
                # Upload chunk to GCS
                storage_service.upload_video_chunk(
                    file_data=chunk_data,
                    user_id=user_id,
                    video_id=video_id,
                    chunk_id=chunk_id,
                    chunk_index=chunk_index
                )

                # Store metadata in Pinecone with text embedding
                vector_db_service.upsert_video_chunk(
                    chunk_id=chunk_id,
                    user_id=user_id,
                    video_id=video_id,
                    text=f"Video {video.filename} chunk {chunk_index}"  # Temporary text, will be VLM output later
                )

                chunk_ids.append(chunk_id)

            # Calculate total duration
            total_duration = chunks[-1][4] if chunks else 0

            return ProcessVideoResponse(
                video_id=video_id,
                user_id=user_id,
                chunk_ids=chunk_ids,
                total_chunks=len(chunks),
                duration_seconds=total_duration
            )

        except Exception as e:
            logger.error(f"Error processing video: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @web_app.post("/retrieve-clips", response_model=RetrieveClipsResponse)
    async def retrieve_clips(request: RetrieveClipsRequest):
        """Retrieve relevant clips for a query"""
        try:
            # Query Pinecone for relevant clips
            clips = vector_db_service.query_clips(
                query_text=request.query,
                user_id=request.user_id,
                top_k=request.top_k
            )

            return RetrieveClipsResponse(
                user_id=request.user_id,
                query=request.query,
                clips=clips
            )

        except Exception as e:
            logger.error(f"Error retrieving clips: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @web_app.post("/get-clip", response_model=GetClipResponse)
    async def get_clip(request: GetClipRequest):
        """Get a specific clip by ID with presigned URL"""
        try:
            # Get chunk metadata from Pinecone
            metadata = vector_db_service.get_chunk_metadata(request.clip_id, request.user_id)

            if metadata.get('user_id') != request.user_id:
                raise HTTPException(status_code=403, detail="Access denied")

            # Reconstruct GCS path from metadata
            video_id = metadata.get('video_id')
            gcs_path = storage_service.get_chunk_path(
                user_id=request.user_id,
                video_id=video_id,
                chunk_id=request.clip_id
            )

            url, expires_at = storage_service.generate_presigned_url(gcs_path)

            return GetClipResponse(
                user_id=request.user_id,
                clip_id=request.clip_id,
                url=url,
                expires_at=expires_at
            )

        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            logger.error(f"Error getting clip: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @web_app.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {
            "status": "healthy",
            "services": {
                "storage": "initialized",
                "vector_db": "initialized",
                "video_processor": "initialized"
            }
        }

    return web_app


@app.local_entrypoint()
def main():
    print("Video Processing API skeleton deployed!")
    print("\nEndpoints:")
    print("  POST /process-video - Upload and process a video")
    print("  POST /retrieve-clips - Search for clips")
    print("  POST /get-clip - Get a specific clip")
    print("  GET /health - Health check")