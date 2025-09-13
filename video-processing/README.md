# Video Processing API

A serverless video processing API built with Modal that handles video uploads, chunking, embedding, and semantic search capabilities.

## Overview

This service provides a scalable video processing pipeline that:
- Accepts video uploads from users
- Splits videos into manageable chunks
- Stores chunks in Google Cloud Storage (GCS)
- Indexes video metadata in Pinecone vector database
- Enables semantic search across video content
- Generates presigned URLs for secure video access

## Architecture

The service is built on **Modal**, a serverless platform that handles:
- Automatic scaling based on demand
- Container orchestration
- Secret management
- GPU acceleration (future enhancement)

### Key Components

- **FastAPI**: REST API framework
- **Modal**: Serverless infrastructure
- **Google Cloud Storage**: Video chunk storage
- **Pinecone**: Vector database for semantic search
- **FFmpeg**: Video processing and chunking

## Features

✅ **Video Upload & Processing**
- Multipart form upload support
- Automatic video validation
- Configurable chunk duration (default: 10 seconds)

✅ **Storage Management**
- Organized bucket structure by user/video/chunk
- Presigned URL generation with expiration
- Efficient chunk retrieval

✅ **Semantic Search**
- Text-based video search (VLM integration planned)
- Top-K similarity search
- User-scoped queries

✅ **Health Monitoring**
- Service status checks
- Component initialization verification

## Tech Stack

- **Runtime**: Python 3.12+
- **Framework**: FastAPI
- **Infrastructure**: Modal
- **Storage**: Google Cloud Storage (S3-compatible)
- **Vector DB**: Pinecone
- **Video Processing**: FFmpeg
- **Validation**: Pydantic

## API Documentation

### POST `/process-video`
Upload and process a video file.

**Request:**
```bash
curl -X POST \
  -F "user_id=user123" \
  -F "video=@/path/to/video.mp4" \
  https://your-api.modal.run/process-video
```

**Response:**
```json
{
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user123",
  "chunk_ids": ["chunk1", "chunk2", "chunk3"],
  "total_chunks": 3,
  "duration_seconds": 30.5
}
```

### POST `/retrieve-clips`
Search for relevant video clips based on a text query.

**Request:**
```json
{
  "user_id": "user123",
  "query": "person waving hello",
  "top_k": 5
}
```

**Response:**
```json
{
  "user_id": "user123",
  "query": "person waving hello",
  "clips": [
    {
      "chunk_id": "chunk1",
      "score": 0.95,
      "user_id": "user123",
      "video_id": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://storage.googleapis.com/...",
      "expires_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### GET `/health`
Check the health status of the service.

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "storage": "initialized",
    "vector_db": "initialized",
    "video_processor": "initialized"
  }
}
```

## Project Structure

```
video-processing/
├── app.py                 # Main Modal application and FastAPI endpoints
├── pyproject.toml         # Project dependencies
├── models/
│   ├── __init__.py
│   └── schemas.py         # Pydantic models for request/response
├── services/
│   ├── __init__.py
│   ├── storage.py         # GCS integration and file management
│   ├── vector_db.py       # Pinecone vector database operations
│   └── video_processor.py # Video chunking and processing logic
├── utils/
│   └── __init__.py        # Utility functions
└── tests/
    └── __init__.py        # Test suite (to be implemented)
```

## Setup Instructions

### Prerequisites

1. **Python 3.12+**
2. **Modal Account**: Sign up at [modal.com](https://modal.com)
3. **Google Cloud Storage**: S3-compatible credentials
4. **Pinecone Account**: API key and index

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd photographic/video-processing
```

2. Install dependencies using `uv`:
```bash
pip install uv
uv sync
```

3. Set up Modal:
```bash
modal setup
```

### Environment Variables

Configure the following secrets in Modal:

#### GCS Credentials (`gcp-credentials`)
```bash
modal secret create gcp-credentials \
  GCP_ACCESS_KEY_ID=<your-access-key> \
  GCP_ACCESS_KEY_SECRET=<your-secret-key>
```

#### Pinecone Credentials (`pinecone-credentials`)
```bash
modal secret create pinecone-credentials \
  PINECONE_API_KEY=<your-api-key> \
  PINECONE_HOST=<your-index-host>
```

## Deployment

Deploy to Modal:
```bash
modal deploy app.py
```

The API will be available at the URL provided by Modal after deployment.

## Development

### Local Development

For local testing with Modal stub:
```bash
modal serve app.py
```

This will hot-reload on code changes.

### Running Tests

```bash
pytest tests/
```

### Code Quality

Format and lint code:
```bash
ruff format .
ruff check .
```

## Configuration

Key configuration parameters in the codebase:

- **Chunk Duration**: 10 seconds (configurable in `video_processor.py`)
- **GCS Bucket**: `photographic-videos`
- **Pinecone Namespace**: `video-chunks`
- **Presigned URL Expiration**: 1 hour
- **Container Timeout**: 600 seconds
- **Min Containers**: 1 (keeps one warm container)

## Future Enhancements

- [ ] **Vision-Language Model (VLM) Integration**: Generate rich text descriptions of video content
- [ ] **GPU Acceleration**: Faster video processing with CUDA support
- [ ] **Batch Processing**: Handle multiple videos in parallel
- [ ] **Video Thumbnails**: Generate preview images for chunks
- [ ] **Advanced Search**: Multi-modal search combining text and visual features
- [ ] **Compression**: Optimize storage with video compression
- [ ] **Streaming Support**: Direct video streaming from GCS
- [ ] **Analytics**: Track usage metrics and search patterns
- [ ] **Rate Limiting**: Implement API rate limits per user
- [ ] **Webhook Support**: Notify clients when processing completes

## Troubleshooting

### Common Issues

1. **FFmpeg not found**: Ensure FFmpeg is installed in the Modal image
2. **GCS connection errors**: Verify credentials and bucket permissions
3. **Pinecone timeout**: Check API key and index host configuration
4. **Large video uploads**: Consider increasing Modal timeout settings

### Debugging

Enable detailed logging:
```python
logging.basicConfig(level=logging.DEBUG)
```

Check Modal logs:
```bash
modal logs -f
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

[Add your license here]

## Support

For issues and questions, please open an issue in the repository.