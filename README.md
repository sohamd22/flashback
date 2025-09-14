# Flashback

Social media without screens - automatically capturing your favorite memories with the people you care about through smart glasses.

## Vision & Achievement

Flashback reimagines social media by prioritizing genuine human connections over endless scrolling. While traditional platforms force users to choose between living in the moment and documenting it, Flashback seamlessly captures precious memories without interrupting the experience. By integrating with Mentra Live smart glasses, we've created a platform where technology fades into the background, allowing people to be fully present while still preserving their most meaningful interactions.

Our platform automatically records and intelligently filters moments based on their significance to each user. Every memory is linked to the people you were with, building a living graph of real relationships rather than superficial online connections. Through natural language search, users can instantly retrieve specific memories - asking questions like "Show me my funniest moment with Alex" to pull up relevant clips in seconds.

We've successfully built a privacy-first social platform that captures what matters most: authentic human connections. The seamless glasses integration means users rarely notice the app running, while our AI-powered memory detection ensures only the most precious moments are saved. The result is a social network that strengthens real relationships instead of replacing them with digital substitutes.

## Technical Overview

<img width="10494" height="5049" alt="image" src="https://github.com/user-attachments/assets/3d22ad86-2530-42f6-ab8b-f748d6404599" />


### Architecture & Stack

**Frontend**: Next.js application with React for the web interface, featuring interactive graph visualizations of user relationships and memory timelines.

**Backend Infrastructure**:
- **Google Cloud Platform**: Core backend infrastructure for video processing and storage
- **Supabase**: PostgreSQL database for user profiles, friend connections, and memory metadata
- **Modal**: Serverless compute platform for running face detection models

### Core Services & Pipeline

**Smart Glasses Integration**:
- MentraOS integration on Mentra Live glasses
- Photo capture at regular intervals (adapted from initial video streaming approach due to hardware limitations)
- Automatic upload to cloud storage for processing
- Web platform supports direct video uploads for memory creation

**AI & Machine Learning Pipeline**:
- **Vector Embeddings**: Videos are converted to vector embeddings for semantic analysis
- **Memory Significance Detection**: Semantic similarity algorithms determine which moments are significant enough to save
- **Face Detection**: Open-source face detection models running on Modal identify registered users in videos
- **Privacy Processing**: Detected faces are matched against registered users; unregistered faces are discarded for privacy

**Search & Retrieval**:
- **Vector Database**: Embeddings stored for natural language semantic search
- **Query Processing**: Natural language queries are converted to embeddings and matched against stored memories
- **Instant Retrieval**: Optimized indexing allows sub-second retrieval of relevant memories

**Social Graph**:
- **Graph Database Structure**: Nodes represent users, edges represent shared memories
- **Relationship Mapping**: Automatic connection creation when memories include multiple registered users
- **Visualization**: Interactive D3.js-based graph showing relationship networks and memory density

### Data Flow

1. Memory capture (photos via Mentra glasses or video uploads via web) → 2. Upload to Google Cloud → 3. Vector embedding generation → 4. Semantic significance analysis → 5. Face detection via Modal → 6. User matching and privacy filtering → 7. Storage in Supabase with metadata → 8. Graph relationship updates → 9. Searchable memory available to users

This architecture enables real-time memory capture and processing while maintaining user privacy and delivering instant search capabilities across potentially thousands of stored memories.
