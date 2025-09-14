# Facial Recognition Video Analysis API

A robust facial recognition system that analyzes videos, detects faces, matches them to contacts, and tracks interactions between people. Built with Modal, FastAPI, and advanced computer vision techniques.

## Features

- **Video Analysis**: Process videos from public URLs and chunk them into 5-second segments
- **Face Detection**: Frame-by-frame face detection using state-of-the-art algorithms
- **Contact Matching**: Match detected faces to existing contacts with high confidence thresholds
- **Automatic Contact Creation**: Create new contacts for unrecognized faces
- **Interaction Tracking**: Track who appears together in video segments to build social graphs
- **Supabase Integration**: Store contacts and analysis results in Supabase database
- **Cloud Storage**: Accept face images from Google Cloud Storage URLs
- **RESTful API**: Clean API endpoints for all operations

## Architecture

```
Video URL → Download → 5s Chunks → Frame Extraction → Face Detection →
Face Matching → Contact Creation → Interaction Analysis → Results Storage
```

### Key Components

- **VideoChunker**: Splits videos into 5-second segments using FFmpeg
- **FaceProcessor**: Detects and encodes faces using face_recognition library
- **FacialRecognitionService**: Orchestrates the entire analysis pipeline
- **SupabaseClient**: Handles database operations for contacts and results
- **Modal App**: Scalable serverless deployment platform

## Setup

### 1. Prerequisites

- Modal CLI installed and configured
- Supabase project with database
- Python 3.8+

### 2. Database Setup

Run the SQL schema in your Supabase database:

```bash
# Apply the schema
psql -h your-supabase-host -U postgres -d postgres < supabase_schema.sql
```

### 3. Configure Secrets

```bash
# Supabase credentials
modal secret create supabase-credentials \
  --from-dict SUPABASE_URL=https://your-project.supabase.co \
  --from-dict SUPABASE_KEY=your_supabase_anon_key
```

### 4. Deploy

```bash
# Quick deployment
python deploy.py

# Or manually
modal deploy app.py
```

## API Usage

### Analyze Video with Contact Images from GCS URLs

```bash
curl -X POST "https://your-modal-app-url/analyze-video" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "video_url": "https://storage.googleapis.com/your-bucket/video.mp4",
    "contacts": [
      {
        "uuid": "contact1",
        "image_url": "https://storage.googleapis.com/your-bucket/john.jpg",
        "name": "John Doe"
      },
      {
        "uuid": "contact2",
        "image_url": "https://storage.googleapis.com/your-bucket/jane.jpg",
        "name": "Jane Smith"
      }
    ]
  }'
```

### Simple Video Analysis (No Contacts, Existing DB Only)

```bash
curl -X POST "https://aryankeluskar--facial-recognition-api-fastapi-app.modal.run/analyze-video" \
  -H "Content-Type: application/json" \
  -d '{
    "requester_user_id": "baf23287-7a8a-45ff-8d6f-2fce87c88d5f",
    "video_url": "https://storage.googleapis.com/hack-bucket25/test-user-123/8c3afd4a-4594-42b2-b609-d6f474778950/0001_8c5e92bb-4546-4776-90ec-b05fbbdb2c64.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=GOOG1EQS5VUGHWOQV7H2DCBO44NK5M6DJ5TEV5Q6WAQPD4MFBX5QIIMCPM36A%2F20250914%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20250914T020141Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=e605fc53a5c0ab3348a0d35fe417868503f075bead844f567b5ed15a5a7a31ac"
  }'
```

### Get Analysis Results

```bash
curl "https://your-modal-app-url/analysis/video_id?user_id=user123"
```

### List User Contacts

```bash
curl "https://your-modal-app-url/contacts/user123"
```

## Response Format

The main analysis endpoint returns:

```json
{
  "video_id": "uuid",
  "user_id": "user123",
  "video_url": "https://...",
  "total_chunks": 36,
  "results": {
    "contact_uuid_1": {
      "chunk_appearances": 12,
      "interactions": {
        "contact_uuid_2": 8,
        "contact_uuid_3": 4
      }
    },
    "contact_uuid_2": {
      "chunk_appearances": 15,
      "interactions": {
        "contact_uuid_1": 8,
        "new_contact_uuid": 3
      }
    }
  }
}
```

## Key Features

### Robust Face Detection
- Frame-by-frame analysis of 5-second video chunks
- Face grouping within chunks to avoid duplicate counting
- Confidence thresholds for reliable matching

### Smart Contact Management
- Automatic contact creation for new faces
- Image storage in Google Cloud Storage
- Face encoding storage in Supabase

### Interaction Analysis
- Track co-appearances in 5-second windows
- Build social interaction graphs
- Frequency counting for relationship strength

### Scalable Architecture
- Serverless deployment with Modal
- Efficient video processing with FFmpeg
- Parallel processing capabilities

## Configuration

Key parameters you can adjust:

- `chunk_duration_seconds`: Video chunk length (default: 5s)
- `face_match_threshold`: Confidence for matching existing contacts (default: 0.6)
- `new_contact_threshold`: Confidence for creating new contacts (default: 0.5)
- `timeout`: Processing timeout (default: 1800s = 30min)
- `memory`: Memory allocation (default: 4GB)

## Testing

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest tests/ -v

# Test specific component
pytest tests/test_face_processor.py -v
```

## Monitoring

```bash
# View app logs
modal app logs facial-recognition-api

# Monitor function calls
modal app list

# Stop the app
modal app stop facial-recognition-api
```

## Performance Considerations

- **Video Size**: Larger videos take longer to process
- **Face Count**: More faces per frame increase processing time
- **Chunk Duration**: Shorter chunks provide more granular interaction data
- **Memory**: Face processing is memory-intensive; 4GB+ recommended
- **Timeout**: Long videos may need extended timeout values

## Security Features

- Secure secret management via Modal
- Public URL validation for video inputs
- Proper error handling and logging
- Database parameter sanitization

## Limitations

- Requires public video URLs (no authentication support yet)
- Face recognition accuracy depends on video quality
- Processing time scales with video length and face count
- Maximum 30-minute timeout per analysis

## Support

For issues or questions:
1. Check the logs: `modal app logs facial-recognition-api`
2. Review the test outputs: `pytest tests/ -v`
3. Validate your secrets and configuration
4. Ensure video URLs are accessible and valid

## Future Enhancements

- Real-time video streaming support
- Advanced face tracking across frames
- Emotion and expression analysis
- Integration with additional storage providers
- Batch processing for multiple videos
- Enhanced privacy and security features