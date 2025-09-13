import boto3
from botocore.config import Config
import requests
from datetime import datetime, timedelta
import logging
from utils.constants import BUCKET_NAME, GCS_ENDPOINT_URL, PRESIGNED_URL_EXPIRY_SECONDS

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self, access_key_id: str, access_key_secret: str):
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=GCS_ENDPOINT_URL,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=access_key_secret,
            region_name="auto",
            use_ssl=True,
            config=Config(signature_version="s3v4"),
        )
        self.bucket_name = BUCKET_NAME

    def upload_video_chunk(
        self,
        file_data: bytes,
        user_id: str,
        video_id: str,
        chunk_id: str,
        chunk_index: int,
    ) -> str:
        """Upload a video chunk to GCS using presigned URL"""
        key = f"{user_id}/{video_id}/{chunk_index:04d}_{chunk_id}.mp4"

        try:
            # Generate presigned URL for upload
            presigned_url = self.s3_client.generate_presigned_url(
                "put_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=3600,
            )

            # Upload using the presigned URL
            response = requests.put(presigned_url, data=file_data)

            if response.status_code != 200:
                raise Exception(
                    f"Upload failed with status {response.status_code}: {response.text}"
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
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": object_key},
                ExpiresIn=PRESIGNED_URL_EXPIRY_SECONDS,
            )
            expires_at = datetime.utcnow() + timedelta(
                seconds=PRESIGNED_URL_EXPIRY_SECONDS
            )
            return url, expires_at
        except Exception as e:
            logger.error(f"Failed to generate presigned URL for {object_key}: {str(e)}")
            raise

    def get_chunk_path(self, user_id: str, video_id: str, chunk_id: str) -> str:
        """Get the GCS path for a chunk given its IDs"""
        prefix = f"{user_id}/{video_id}/"

        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name, Prefix=prefix
            )

            if "Contents" not in response:
                raise ValueError(f"No chunks found for video {video_id}")

            for obj in response["Contents"]:
                if chunk_id in obj["Key"]:
                    return obj["Key"]

            raise ValueError(f"Chunk {chunk_id} not found")
        except Exception as e:
            logger.error(f"Failed to get chunk path: {str(e)}")
            raise

    def delete_video_chunks(self, user_id: str, video_id: str) -> int:
        """Delete all chunks for a given video"""
        prefix = f"{user_id}/{video_id}/"

        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name, Prefix=prefix
            )

            if "Contents" not in response:
                return 0

            objects = [{"Key": obj["Key"]} for obj in response["Contents"]]

            self.s3_client.delete_objects(
                Bucket=self.bucket_name, Delete={"Objects": objects}
            )

            deleted_count = len(objects)
            logger.info(f"Deleted {deleted_count} chunks for video {video_id}")
            return deleted_count
        except Exception as e:
            logger.error(f"Failed to delete video chunks: {str(e)}")
            raise
