import logging
import httpx
from typing import Optional, List

logger = logging.getLogger(__name__)

# Hardcoded Modal endpoint for facial recognition API
FACIAL_RECOGNITION_API_URL = "https://aryankeluskar--facial-recognition-api-fastapi-app.modal.run"


class FacialRecognitionService:
    """Service for integrating with the facial recognition Modal endpoint"""

    def __init__(self):
        self.base_url = FACIAL_RECOGNITION_API_URL
        self.timeout = httpx.Timeout(5.0, connect=2.0)  # Short timeout for fire-and-forget

    async def analyze_video_async(
        self,
        user_id: str,
        video_url: str,
        target_profiles: Optional[List[str]] = None
    ) -> None:
        """
        Send video for facial recognition analysis (fire-and-forget).

        Args:
            user_id: The user ID who uploaded the video
            video_url: Public URL to the video file
            target_profiles: Optional list of specific profile IDs to search for
        """
        endpoint = f"{self.base_url}/analyze-video"

        payload = {
            "requester_user_id": user_id,
            "video_url": video_url,
        }

        if target_profiles:
            payload["target_profiles"] = target_profiles

        try:
            # Fire-and-forget: we don't wait for or process the response
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                logger.info(f"Sending video {video_url} to facial recognition service for user {user_id}")

                # We don't await the response fully - just ensure the request is sent
                response = await client.post(
                    endpoint,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )

                # Just log the status for monitoring
                logger.info(f"Facial recognition request sent with status: {response.status_code}")

        except httpx.TimeoutException:
            # Log but don't fail - this is fire-and-forget
            logger.warning(f"Facial recognition request timed out for video {video_url}")
        except Exception as e:
            # Log any errors but don't propagate them
            logger.error(f"Failed to send video to facial recognition service: {str(e)}")