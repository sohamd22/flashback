from pydantic import BaseModel
from typing import List, Optional, Dict, Any
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


class ClipWithUrl(BaseModel):
    chunk_id: str
    score: float
    user_id: str
    video_id: str
    url: str
    expires_at: datetime


class RetrieveClipsResponse(BaseModel):
    user_id: str
    query: str
    clips: List[ClipWithUrl]


class ClipWithDescription(BaseModel):
    chunk_id: str
    score: float
    user_id: str
    video_id: str
    description: str
    url: str
    expires_at: datetime


class RetrieveClipsWithDescriptionsResponse(BaseModel):
    user_id: str
    query: str
    clips: List[ClipWithDescription]


class ProcessPhotoResponse(BaseModel):
    photo_id: str
    user_id: str
    description: str
    stored: bool


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
    transcription: Optional[str] = None
    transcription_words: Optional[List[Dict[str, Any]]] = None
