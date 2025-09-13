#!/usr/bin/env python3
import requests
import sys
from pathlib import Path

# Configuration
API_URL = "https://jzflint--video-processing-api-fastapi-app.modal.run/process-video"
VIDEO_PATH = Path(__file__).parent / "demo_vid.mov"
USER_ID = "test-user-123"

def test_process_video():
    """Test the process-video endpoint"""

    if not VIDEO_PATH.exists():
        print(f"❌ Video file not found: {VIDEO_PATH}")
        sys.exit(1)

    print(f"📹 Testing video processing endpoint...")
    print(f"   Video: {VIDEO_PATH.name}")
    print(f"   Size: {VIDEO_PATH.stat().st_size / 1024 / 1024:.2f} MB")
    print(f"   User ID: {USER_ID}")
    print(f"   Endpoint: {API_URL}")
    print()

    try:
        # Prepare the request
        with open(VIDEO_PATH, 'rb') as video_file:
            files = {'video': (VIDEO_PATH.name, video_file, 'video/quicktime')}
            data = {'user_id': USER_ID}

            print("⏳ Uploading and processing video...")
            response = requests.post(API_URL, files=files, data=data, timeout=120)

        # Check response
        if response.status_code == 200:
            result = response.json()
            print("✅ Video processed successfully!")
            print("\n📊 Results:")
            print(f"   Video ID: {result.get('video_id')}")
            print(f"   User ID: {result.get('user_id')}")
            print(f"   Total chunks: {result.get('total_chunks')}")
            print(f"   Duration: {result.get('duration_seconds')} seconds")
            print(f"   Chunk IDs: {len(result.get('chunk_ids', []))} chunks created")

            if result.get('chunk_ids'):
                print("\n📦 First 3 chunk IDs:")
                for i, chunk_id in enumerate(result['chunk_ids'][:3], 1):
                    print(f"   {i}. {chunk_id}")
                if len(result['chunk_ids']) > 3:
                    print(f"   ... and {len(result['chunk_ids']) - 3} more")

        else:
            print(f"❌ Failed with status code: {response.status_code}")
            print(f"   Response: {response.text}")

    except requests.exceptions.Timeout:
        print("❌ Request timed out. The video might be too large or the server is processing slowly.")
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

def test_retrieve_clips():
    """Test the retrieve-clips endpoint"""
    QUERY_TEXT = "test query"
    response = requests.post(API_URL, json={"user_id": USER_ID, "query": QUERY_TEXT})

    if response.status_code == 200:
        result = response.json()
        print("✅ Clips retrieved successfully!")
        print("\n📊 Results:")
        print(f"   User ID: {result.get('user_id')}")
        print(f"   Query: {result.get('query')}")
        print(f"   Clips: {result.get('clips')}")
    else:
        print(f"❌ Failed with status code: {response.status_code}")
        print(f"   Response: {response.text}")

if __name__ == "__main__":
    test_process_video()