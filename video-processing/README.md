# Video Processing API - I/O Schemas

## Endpoints

### POST /process-video
**Input:**
- `user_id`: string (form data)
- `video`: file upload

**Output:**
```json
{
  "chunk_id": "uuid",
  "user_id": "string",
  "filename": "string"
}
```

### POST /retrieve-clips
**Input:**
```json
{
  "user_id": "string",
  "query": "string",
  "top_k": 10
}
```

**Output:**
```json
{
  "user_id": "string",
  "query": "string",
  "clips": []
}
```

### POST /get-clip
**Input:**
```json
{
  "user_id": "string",
  "clip_id": "string"
}
```

**Output:**
```json
{
  "user_id": "string",
  "clip_id": "string",
  "url": null
}
```

### GET /health
**Output:**
```json
{
  "status": "healthy",
  "gcs": "connected",
  "pinecone": "connected"
}
```