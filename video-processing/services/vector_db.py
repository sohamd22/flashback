from pinecone import Pinecone
import json
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class VectorDBService:
    def __init__(self, api_key: str, index_host: str):
        self.pc = Pinecone(api_key=api_key)
        # Connect directly to the existing index using host
        self.index = self.pc.Index(host=index_host)
        logger.info(f"Connected to Pinecone index at {index_host}")

    def upsert_video_chunk(self, chunk_id: str, user_id: str, video_id: str, text: str):
        """Store video chunk with text embedding in Pinecone"""
        metadata = {"user_id": user_id, "video_id": video_id, "chunk_id": chunk_id}

        try:
            self.index.upsert_records(
                records=[
                    {
                        "id": chunk_id,
                        "text": text,  # Text will be embedded by Pinecone
                        "metadata": json.dumps(metadata),
                    }
                ],
                namespace=user_id,  # Use user_id as namespace
            )
            logger.info(f"Upserted chunk {chunk_id} to namespace {user_id}")
        except Exception as e:
            logger.error(f"Failed to upsert chunk {chunk_id}: {str(e)}")
            raise

    def query_clips(
        self, query_text: str, user_id: str, top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """Query for relevant video clips"""
        try:
            embed_response = self.pc.inference.embed(
                model="llama-text-embed-v2",
                inputs=[{"text": query_text}],
                parameters={"input_type": "query"},
            )
            vector = embed_response.data[0].values
            results = self.index.query(
                vector=vector,  # Text will be embedded by Pinecone
                top_k=top_k,
                namespace=user_id,  # Use user_id as namespace
                include_metadata=True,
            )

            clips = []
            for match in results.matches:
                metadata = json.loads(match.metadata.get("metadata"))
                clips.append(
                    {
                        "chunk_id": match.id,
                        "score": match.score,
                        "user_id": metadata.get("user_id"),
                        "video_id": metadata.get("video_id"),
                    }
                )

            logger.info(f"Found {len(clips)} clips for query: {query_text}")
            return clips
        except Exception as e:
            logger.error(f"Failed to query clips: {str(e)}")
            raise

    def get_chunk_metadata(self, chunk_id: str, user_id: str) -> Dict[str, Any]:
        """Fetch metadata for a specific chunk"""
        try:
            results = self.index.fetch(
                ids=[chunk_id],
                namespace=user_id,  # Use user_id as namespace
            )

            if chunk_id not in results.vectors:
                raise ValueError(f"Chunk {chunk_id} not found")

            vector_data = results.vectors[chunk_id].metadata
            return vector_data
        except Exception as e:
            logger.error(f"Failed to get chunk metadata: {str(e)}")
            raise

    def delete_video_chunks(self, user_id: str, video_id: str):
        """Delete all chunks for a given video from Pinecone"""
        try:
            # Query with a generic text to find all chunks for this video
            results = self.index.query(
                vector="video chunk",  # Generic query text
                top_k=10000,
                namespace=user_id,  # Use user_id as namespace
                filter={"video_id": video_id},
            )

            chunk_ids = [match.id for match in results.matches]

            if chunk_ids:
                self.index.delete(
                    ids=chunk_ids,
                    namespace=user_id,  # Use user_id as namespace
                )
                logger.info(f"Deleted {len(chunk_ids)} chunks from namespace {user_id}")

        except Exception as e:
            logger.error(f"Failed to delete video chunks from Pinecone: {str(e)}")
            raise
