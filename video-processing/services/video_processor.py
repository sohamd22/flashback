import tempfile
import os
import subprocess
import logging
from typing import List, Tuple, BinaryIO
import uuid
from utils.constants import (
    CHUNK_DURATION_SECONDS,
    TEMP_DIR,
    VIDEO_CHUNK_FORMAT
)

logger = logging.getLogger(__name__)


class VideoProcessor:
    def __init__(self):
        self.chunk_duration = CHUNK_DURATION_SECONDS

    def get_video_duration(self, video_path: str) -> float:
        """Get the duration of a video file in seconds"""
        try:
            cmd = [
                'ffprobe',
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                video_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            duration = float(result.stdout.strip())
            logger.info(f"Video duration: {duration} seconds")
            return duration
        except Exception as e:
            logger.error(f"Failed to get video duration: {str(e)}")
            raise

    def split_video(self, video_data: bytes, video_id: str) -> List[Tuple[str, bytes, int, float, float]]:
        """
        Split video into chunks of specified duration
        Returns list of (chunk_id, chunk_data, chunk_index, start_time, end_time)
        """
        chunks = []

        with tempfile.NamedTemporaryFile(suffix='.mp4', dir=TEMP_DIR, delete=False) as input_file:
            input_file.write(video_data)
            input_file.flush()
            input_path = input_file.name

            try:
                duration = self.get_video_duration(input_path)
                num_chunks = int(duration / self.chunk_duration) + (1 if duration % self.chunk_duration > 0 else 0)

                logger.info(f"Splitting video into {num_chunks} chunks of {self.chunk_duration} seconds")

                for i in range(num_chunks):
                    chunk_id = str(uuid.uuid4())
                    start_time = i * self.chunk_duration
                    end_time = min((i + 1) * self.chunk_duration, duration)
                    actual_duration = end_time - start_time

                    output_path = os.path.join(TEMP_DIR, f"{chunk_id}.{VIDEO_CHUNK_FORMAT}")

                    try:
                        cmd = [
                            'ffmpeg',
                            '-i', input_path,
                            '-ss', str(start_time),
                            '-t', str(actual_duration),
                            '-c:v', 'libx264',
                            '-c:a', 'aac',
                            '-preset', 'fast',
                            '-movflags', '+faststart',
                            '-y',
                            output_path
                        ]

                        subprocess.run(cmd, capture_output=True, check=True)

                        with open(output_path, 'rb') as chunk_file:
                            chunk_data = chunk_file.read()

                        chunks.append((chunk_id, chunk_data, i, start_time, end_time))
                        logger.info(f"Created chunk {i+1}/{num_chunks}: {chunk_id}")

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

    def extract_thumbnail(self, video_data: bytes, timestamp: float = 0) -> bytes:
        """Extract a thumbnail from a video at the specified timestamp"""
        with tempfile.NamedTemporaryFile(suffix='.mp4', dir=TEMP_DIR, delete=False) as input_file:
            input_file.write(video_data)
            input_file.flush()
            input_path = input_file.name

            thumbnail_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}.jpg")

            try:
                cmd = [
                    'ffmpeg',
                    '-i', input_path,
                    '-ss', str(timestamp),
                    '-vframes', '1',
                    '-q:v', '2',
                    '-y',
                    thumbnail_path
                ]

                subprocess.run(cmd, capture_output=True, check=True)

                with open(thumbnail_path, 'rb') as thumb_file:
                    thumbnail_data = thumb_file.read()

                return thumbnail_data

            except subprocess.CalledProcessError as e:
                logger.error(f"Failed to extract thumbnail: {e.stderr.decode()}")
                raise
            finally:
                if os.path.exists(input_path):
                    os.remove(input_path)
                if os.path.exists(thumbnail_path):
                    os.remove(thumbnail_path)

    def validate_video(self, video_data: bytes) -> bool:
        """Validate that the uploaded file is a valid video"""
        with tempfile.NamedTemporaryFile(suffix='.mp4', dir=TEMP_DIR, delete=False) as temp_file:
            temp_file.write(video_data)
            temp_file.flush()
            temp_path = temp_file.name

            try:
                cmd = [
                    'ffprobe',
                    '-v', 'error',
                    '-select_streams', 'v:0',
                    '-show_entries', 'stream=codec_type',
                    '-of', 'default=noprint_wrappers=1:nokey=1',
                    temp_path
                ]
                result = subprocess.run(cmd, capture_output=True, text=True)
                is_valid = result.stdout.strip() == 'video'
                logger.info(f"Video validation: {'valid' if is_valid else 'invalid'}")
                return is_valid
            except Exception as e:
                logger.error(f"Failed to validate video: {str(e)}")
                return False
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)