import anthropic
import base64
import tempfile
import os
import subprocess
import logging
from typing import List, Tuple, Optional, Dict, Any
import uuid
from utils.constants import TEMP_DIR, SLIDING_WINDOW_SECONDS, CHUNK_DURATION_SECONDS

logger = logging.getLogger(__name__)


class VLMService:
    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.sliding_window_chunks = int(
            SLIDING_WINDOW_SECONDS / CHUNK_DURATION_SECONDS
        )
        logger.info(
            f"Initialized VLM service with Anthropic API (sliding window: {self.sliding_window_chunks} chunks)"
        )

    def extract_keyframes(
        self, video_data: bytes, timestamps: List[float] = None
    ) -> List[bytes]:
        """
        Extract keyframes from video chunk at specified timestamps
        If no timestamps provided, extracts at 25%, 50%, 75% of duration
        """
        if timestamps is None:
            timestamps = [0.25, 0.5, 0.75]

        frames = []

        with tempfile.NamedTemporaryFile(
            suffix=".mp4", dir=TEMP_DIR, delete=False
        ) as input_file:
            input_file.write(video_data)
            input_file.flush()
            input_path = input_file.name

            try:
                duration = self._get_video_duration(input_path)

                for timestamp_ratio in timestamps:
                    timestamp = duration * timestamp_ratio
                    frame_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}.jpg")

                    try:
                        cmd = [
                            "ffmpeg",
                            "-i",
                            input_path,
                            "-ss",
                            str(timestamp),
                            "-vframes",
                            "1",
                            "-q:v",
                            "2",
                            "-y",
                            frame_path,
                        ]

                        subprocess.run(cmd, capture_output=True, check=True)

                        with open(frame_path, "rb") as frame_file:
                            frame_data = frame_file.read()
                            frames.append(frame_data)

                        logger.info(f"Extracted keyframe at {timestamp:.2f}s")

                    except subprocess.CalledProcessError as e:
                        logger.error(
                            f"Failed to extract keyframe at {timestamp}: {e.stderr.decode()}"
                        )
                    finally:
                        if os.path.exists(frame_path):
                            os.remove(frame_path)

            finally:
                if os.path.exists(input_path):
                    os.remove(input_path)

        return frames

    def _get_video_duration(self, video_path: str) -> float:
        """Get video duration in seconds"""
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
            return float(result.stdout.strip())
        except Exception as e:
            logger.error(f"Failed to get video duration: {str(e)}")
            return 10.0

    def generate_description(
        self,
        video_chunk_data: bytes,
        chunk_index: int,
        start_time: float,
        end_time: float,
        video_filename: str = "video",
        previous_descriptions: Optional[List[Tuple[int, float, float, str]]] = None,
        current_transcription: Optional[str] = None,
        previous_transcription: Optional[str] = None,
    ) -> str:
        """
        Generate natural language description of video chunk using Claude Vision
        Enhanced with audio transcription context
        """
        try:
            keyframes = self.extract_keyframes(video_chunk_data)

            if not keyframes:
                logger.warning(f"No keyframes extracted for chunk {chunk_index}")
                return f"Video segment {chunk_index} from {start_time:.1f}s to {end_time:.1f}s"

            # Build prompt with context from previous descriptions if available
            prompt_text = f"""Analyze these keyframes from a video segment (chunk {chunk_index},
                    time {start_time:.1f}s to {end_time:.1f}s from file '{video_filename}').
            """

            # Add audio transcription context
            if current_transcription:
                prompt_text += f"\n\nAudio transcription for this segment:\n\"{current_transcription}\""

            if previous_transcription:
                prompt_text += f"\n\nAudio from previous segment:\n\"{previous_transcription}\""

            # Add context from previous descriptions
            if previous_descriptions:
                prompt_text += "\n\nContext from previous segments:\n"
                for prev_idx, prev_start, prev_end, prev_desc in previous_descriptions:
                    prompt_text += f"\n- Segment {prev_idx} ({prev_start:.1f}s-{prev_end:.1f}s): {prev_desc}"
                prompt_text += (
                    "\n\nBased on the audio, context above and the current keyframes, "
                )
            else:
                prompt_text += "\n\n"

            prompt_text += """Provide a comprehensive description that includes:
                    1. Main subjects and activities
                    2. Scene setting and environment
                    3. Notable objects or text visible
                    4. Any dialogue or speech content (integrate naturally with visual description)
                    5. How audio content relates to visual content
                    6. Any significant changes between frames
                    7. Overall context and mood
                    8. How this segment relates to or continues from previous segments (if applicable)

                    Format your response as a single, searchable paragraph optimized for semantic search.
                    Focus on concrete, observable details and spoken content that would help someone find this segment."""

            content = [
                {
                    "type": "text",
                    "text": prompt_text,
                }
            ]

            for i, frame_data in enumerate(keyframes):
                base64_image = base64.b64encode(frame_data).decode("utf-8")
                content.append(
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": base64_image,
                        },
                    }
                )

            response = self.client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=300,
                messages=[{"role": "user", "content": content}],
            )

            description = response.content[0].text
            logger.info(
                f"Generated description for chunk {chunk_index}: {description[:100]}..."
            )

            return f"Segment {chunk_index} ({start_time:.1f}s-{end_time:.1f}s): {description}"

        except Exception as e:
            logger.error(
                f"Failed to generate description for chunk {chunk_index}: {str(e)}"
            )
            return f"Video segment {chunk_index} from {video_filename} ({start_time:.1f}s to {end_time:.1f}s)"

    def generate_batch_descriptions(
        self,
        chunks: List[Tuple[str, bytes, int, float, float]],
        video_filename: str = "video",
        transcriptions: Optional[List[Dict[str, Any]]] = None,
    ) -> List[str]:
        """
        Generate descriptions for multiple video chunks with sliding window context
        Enhanced with transcription context
        Returns list of descriptions in same order as chunks
        """
        descriptions = []
        description_history = []  # List of (chunk_index, start_time, end_time, description_text)
        previous_transcription = None

        for i, (chunk_id, chunk_data, chunk_index, start_time, end_time) in enumerate(chunks):
            # Get current transcription if available
            current_transcription = None
            if transcriptions and i < len(transcriptions):
                current_transcription = transcriptions[i].get("text", "")
            # Calculate which previous descriptions to include based on sliding window
            relevant_context = []

            if description_history:
                # Include descriptions within the sliding window time range
                window_start_time = max(0, start_time - SLIDING_WINDOW_SECONDS)

                for hist_idx, hist_start, hist_end, hist_desc in description_history:
                    # Include if the historical chunk ends after our window start
                    if hist_end > window_start_time and hist_idx < chunk_index:
                        relevant_context.append(
                            (hist_idx, hist_start, hist_end, hist_desc)
                        )

                # Limit to most recent chunks based on sliding_window_chunks
                if len(relevant_context) > self.sliding_window_chunks:
                    relevant_context = relevant_context[-self.sliding_window_chunks :]

                logger.info(
                    f"Processing chunk {chunk_index} with context from {len(relevant_context)} previous chunks"
                )

            # Generate description with context and transcription
            description = self.generate_description(
                chunk_data,
                chunk_index,
                start_time,
                end_time,
                video_filename,
                previous_descriptions=relevant_context if relevant_context else None,
                current_transcription=current_transcription,
                previous_transcription=previous_transcription,
            )

            # Extract just the description text (remove the prefix)
            if ": " in description:
                description_text = description.split(": ", 1)[1]
            else:
                description_text = description

            # Add to history for future chunks
            description_history.append(
                (chunk_index, start_time, end_time, description_text)
            )

            # Keep full formatted description for return
            descriptions.append(description)

            # Update previous transcription for next iteration
            previous_transcription = current_transcription

        return descriptions
