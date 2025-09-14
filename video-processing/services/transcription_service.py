import tempfile
import os
import subprocess
import logging
from typing import Optional, Dict, Any
import uuid
from openai import OpenAI
from utils.constants import TEMP_DIR

logger = logging.getLogger(__name__)


class TranscriptionService:
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        logger.info("Initialized Transcription service with OpenAI Whisper API")

    def extract_audio_from_video(self, video_data: bytes) -> bytes:
        """
        Extract audio from video chunk and return as MP3 bytes
        """
        with tempfile.NamedTemporaryFile(
            suffix=".mp4", dir=TEMP_DIR, delete=False
        ) as input_file:
            input_file.write(video_data)
            input_file.flush()
            input_path = input_file.name

            audio_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}.mp3")

            try:
                cmd = [
                    "ffmpeg",
                    "-i",
                    input_path,
                    "-vn",  # No video
                    "-acodec",
                    "mp3",
                    "-ab",
                    "128k",  # Audio bitrate
                    "-ar",
                    "16000",  # Sample rate optimized for speech
                    "-y",
                    audio_path,
                ]

                result = subprocess.run(cmd, capture_output=True, check=True)

                with open(audio_path, "rb") as audio_file:
                    audio_data = audio_file.read()

                logger.info(f"Extracted audio, size: {len(audio_data)} bytes")
                return audio_data

            except subprocess.CalledProcessError as e:
                logger.error(f"Failed to extract audio: {e.stderr.decode()}")
                raise
            finally:
                if os.path.exists(input_path):
                    os.remove(input_path)
                if os.path.exists(audio_path):
                    os.remove(audio_path)

    def transcribe_chunk(
        self,
        video_chunk_data: bytes,
        chunk_index: int,
        start_time: float,
        end_time: float,
    ) -> Dict[str, Any]:
        """
        Transcribe audio from video chunk using OpenAI Whisper
        Returns dict with transcription text and metadata
        """
        try:
            # Extract audio from video
            audio_data = self.extract_audio_from_video(video_chunk_data)

            if not audio_data:
                logger.warning(f"No audio extracted for chunk {chunk_index}")
                return {
                    "text": "",
                    "chunk_index": chunk_index,
                    "start_time": start_time,
                    "end_time": end_time,
                }

            # Create temporary file for audio (Whisper API requires file)
            with tempfile.NamedTemporaryFile(
                suffix=".mp3", dir=TEMP_DIR, delete=False
            ) as audio_file:
                audio_file.write(audio_data)
                audio_file.flush()
                audio_path = audio_file.name

                try:
                    # Transcribe using Whisper API
                    with open(audio_path, "rb") as f:
                        response = self.client.audio.transcriptions.create(
                            model="whisper-1",
                            file=f,
                            response_format="verbose_json",
                            timestamp_granularities=["word", "segment"]
                        )

                    # Process response
                    transcription_text = response.text if hasattr(response, 'text') else ""

                    # Get word-level timestamps if available
                    words = []
                    if hasattr(response, 'words'):
                        words = [
                            {
                                "word": w.word,
                                "start": w.start + start_time,  # Adjust to video timeline
                                "end": w.end + start_time,
                            }
                            for w in response.words
                        ]

                    result = {
                        "text": transcription_text,
                        "chunk_index": chunk_index,
                        "start_time": start_time,
                        "end_time": end_time,
                        "words": words,
                        "language": response.language if hasattr(response, 'language') else "unknown",
                    }

                    logger.info(
                        f"Transcribed chunk {chunk_index}: {len(transcription_text)} chars"
                    )

                    return result

                finally:
                    if os.path.exists(audio_path):
                        os.remove(audio_path)

        except Exception as e:
            logger.error(f"Failed to transcribe chunk {chunk_index}: {str(e)}")
            return {
                "text": "",
                "chunk_index": chunk_index,
                "start_time": start_time,
                "end_time": end_time,
                "error": str(e),
            }

    def transcribe_batch(
        self,
        chunks: list,
    ) -> list:
        """
        Transcribe multiple video chunks
        Returns list of transcription results in same order as chunks
        """
        transcriptions = []

        for chunk_id, chunk_data, chunk_index, start_time, end_time in chunks:
            transcription = self.transcribe_chunk(
                video_chunk_data=chunk_data,
                chunk_index=chunk_index,
                start_time=start_time,
                end_time=end_time,
            )
            transcriptions.append(transcription)

        return transcriptions