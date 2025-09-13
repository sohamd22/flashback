import modal
import os
import uuid

import boto3
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pinecone import Pinecone

app = modal.App("video-processing-api")

# Minimal image with required dependencies
image = modal.Image.debian_slim().pip_install(
    "boto3",
    "pinecone",
    "fastapi",
    "python-multipart",
)

# Secrets
gcs_secret = modal.Secret.from_name(
    "gcp-credentials",
    required_keys=["GCP_ACCESS_KEY_ID", "GCP_ACCESS_KEY_SECRET"],
)

pinecone_secret = modal.Secret.from_name(
    "pinecone-credentials",
    required_keys=["PINECONE_HOST", "PINECONE_API_KEY"],
)

# Request/Response models
class RetrieveClipsRequest(BaseModel):
    user_id: str
    query: str
    top_k: int = 10

class GetClipRequest(BaseModel):
    user_id: str
    clip_id: str

# Constants
BUCKET_NAME = "hack-bucket25"


@app.function(
    image=image,
    secrets=[gcs_secret, pinecone_secret],
)
@modal.asgi_app()
def fastapi_app():
    web_app = FastAPI(title="Video Processing API")

    # Initialize S3 client for GCS
    s3_client = boto3.client(
        's3',
        endpoint_url='https://storage.googleapis.com',
        aws_access_key_id=os.environ['GCP_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['GCP_ACCESS_KEY_SECRET'],
        use_ssl=True,
    )

    # Initialize Pinecone
    pc = Pinecone(api_key=os.environ['PINECONE_API_KEY'])

    # Store clients for use in endpoints
    web_app.state.s3_client = s3_client
    web_app.state.pc = pc

    @web_app.post("/process-video")
    async def process_video(
        user_id: str = Form(...),
        video: UploadFile = File(...)
    ):
        """Process and store a video chunk"""
        # Generate unique ID
        chunk_id = str(uuid.uuid4())

        # TODO: Upload video to GCS
        # TODO: Extract embeddings
        # TODO: Store in Pinecone

        return JSONResponse(content={
            "chunk_id": chunk_id,
            "user_id": user_id,
            "filename": video.filename,
        })

    @web_app.post("/retrieve-clips")
    async def retrieve_clips(request: RetrieveClipsRequest):
        """Retrieve relevant clips for a query"""
        # TODO: Generate query embedding
        # TODO: Search Pinecone

        return JSONResponse(content={
            "user_id": request.user_id,
            "query": request.query,
            "clips": [],
        })

    @web_app.post("/get-clip")
    async def get_clip(request: GetClipRequest):
        """Get a specific clip by ID"""
        # TODO: Fetch from GCS
        # TODO: Generate presigned URL

        return JSONResponse(content={
            "user_id": request.user_id,
            "clip_id": request.clip_id,
            "url": None,
        })

    @web_app.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {"status": "healthy", "gcs": "connected", "pinecone": "connected"}

    return web_app


@app.local_entrypoint()
def main():
    print("Video Processing API skeleton deployed!")
    print("\nEndpoints:")
    print("  POST /process-video - Upload and process a video")
    print("  POST /retrieve-clips - Search for clips")
    print("  POST /get-clip - Get a specific clip")
    print("  GET /health - Health check")