from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ProcessVideoResponse(BaseModel):
    video_id: str
    user_id: str
    chunk_ids: List[str]
    total_chunks: int
    duration_seconds: float


class RetrieveClipsRequest(BaseModel):
    user_id: str
    query: str
    top_k: int = 10


class RetrieveClipsResponse(BaseModel):
    user_id: str
    query: str
    clips: List[dict]


class GetClipRequest(BaseModel):
    user_id: str
    clip_id: str


class GetClipResponse(BaseModel):
    user_id: str
    clip_id: str
    url: str
    expires_at: datetime


class VideoChunkMetadata(BaseModel):
    chunk_id: str
    user_id: str
    video_id: str
    chunk_index: int
    start_time: float
    end_time: float
    duration: float
    gcs_path: str
    timestamp: datetime