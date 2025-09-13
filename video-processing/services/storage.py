import boto3
from datetime import datetime, timedelta
from typing import BinaryIO
import logging
from utils.constants import (
    BUCKET_NAME,
    GCS_ENDPOINT_URL,
    PRESIGNED_URL_EXPIRY_SECONDS
)

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self, access_key_id: str, access_key_secret: str):
        self.s3_client = boto3.client(
            's3',
            endpoint_url=GCS_ENDPOINT_URL,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=access_key_secret,
            use_ssl=True,
        )
        self.bucket_name = BUCKET_NAME

    def upload_video_chunk(
        self,
        file_data: bytes,
        user_id: str,
        video_id: str,
        chunk_id: str,
        chunk_index: int
    ) -> str:
        """Upload a video chunk to GCS"""
        key = f"{user_id}/{video_id}/{chunk_index:04d}_{chunk_id}.mp4"

        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=file_data,
                ContentType='video/mp4',
                Metadata={
                    'user_id': user_id,
                    'video_id': video_id,
                    'chunk_id': chunk_id,
                    'chunk_index': str(chunk_index),
                    'uploaded_at': datetime.utcnow().isoformat()
                }
            )
            logger.info(f"Uploaded chunk {chunk_id} to {key}")
            return key
        except Exception as e:
            logger.error(f"Failed to upload chunk {chunk_id}: {str(e)}")
            raise

    def generate_presigned_url(self, object_key: str) -> tuple[str, datetime]:
        """Generate a presigned URL for downloading a video chunk"""
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': object_key
                },
                ExpiresIn=PRESIGNED_URL_EXPIRY_SECONDS
            )
            expires_at = datetime.utcnow() + timedelta(seconds=PRESIGNED_URL_EXPIRY_SECONDS)
            return url, expires_at
        except Exception as e:
            logger.error(f"Failed to generate presigned URL for {object_key}: {str(e)}")
            raise

    def get_chunk_path(self, user_id: str, video_id: str, chunk_id: str) -> str:
        """Get the GCS path for a chunk given its IDs"""
        prefix = f"{user_id}/{video_id}/"

        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )

            if 'Contents' not in response:
                raise ValueError(f"No chunks found for video {video_id}")

            for obj in response['Contents']:
                if chunk_id in obj['Key']:
                    return obj['Key']

            raise ValueError(f"Chunk {chunk_id} not found")
        except Exception as e:
            logger.error(f"Failed to get chunk path: {str(e)}")
            raise

    def delete_video_chunks(self, user_id: str, video_id: str) -> int:
        """Delete all chunks for a given video"""
        prefix = f"{user_id}/{video_id}/"

        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )

            if 'Contents' not in response:
                return 0

            objects = [{'Key': obj['Key']} for obj in response['Contents']]

            self.s3_client.delete_objects(
                Bucket=self.bucket_name,
                Delete={'Objects': objects}
            )

            deleted_count = len(objects)
            logger.info(f"Deleted {deleted_count} chunks for video {video_id}")
            return deleted_count
        except Exception as e:
            logger.error(f"Failed to delete video chunks: {str(e)}")
            raise