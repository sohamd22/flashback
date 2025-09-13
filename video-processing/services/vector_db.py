from pinecone import Pinecone, ServerlessSpec
from typing import List, Dict, Any
import logging
import numpy as np
from datetime import datetime
from utils.constants import (
    PINECONE_INDEX_NAME,
    PINECONE_NAMESPACE,
    EMBEDDING_DIMENSION
)

logger = logging.getLogger(__name__)


class VectorDBService:
    def __init__(self, api_key: str):
        self.pc = Pinecone(api_key=api_key)
        self.index_name = PINECONE_INDEX_NAME
        self.namespace = PINECONE_NAMESPACE
        self._ensure_index()

    def _ensure_index(self):
        """Ensure the Pinecone index exists"""
        existing_indexes = [index.name for index in self.pc.list_indexes()]

        if self.index_name not in existing_indexes:
            logger.info(f"Creating index {self.index_name}")
            self.pc.create_index(
                name=self.index_name,
                dimension=EMBEDDING_DIMENSION,
                metric='cosine',
                spec=ServerlessSpec(
                    cloud='aws',
                    region='us-east-1'
                )
            )

        self.index = self.pc.Index(self.index_name)

    def _generate_hardcoded_embedding(self, text: str = None) -> List[float]:
        """Generate a hardcoded embedding for testing"""
        np.random.seed(hash(text) % 2**32 if text else 42)
        embedding = np.random.randn(EMBEDDING_DIMENSION).astype(float)
        embedding = embedding / np.linalg.norm(embedding)
        return embedding.tolist()

    def upsert_video_chunk(
        self,
        chunk_id: str,
        user_id: str,
        video_id: str,
        chunk_index: int,
        gcs_path: str,
        start_time: float,
        end_time: float,
        text_description: str = None
    ):
        """Store video chunk metadata and embedding in Pinecone"""
        embedding = self._generate_hardcoded_embedding(text_description or chunk_id)

        metadata = {
            'user_id': user_id,
            'video_id': video_id,
            'chunk_index': chunk_index,
            'gcs_path': gcs_path,
            'start_time': start_time,
            'end_time': end_time,
            'duration': end_time - start_time,
            'timestamp': datetime.utcnow().isoformat(),
            'description': text_description or f"Chunk {chunk_index} of video {video_id}"
        }

        try:
            self.index.upsert(
                vectors=[{
                    'id': chunk_id,
                    'values': embedding,
                    'metadata': metadata
                }],
                namespace=self.namespace
            )
            logger.info(f"Upserted chunk {chunk_id} to Pinecone")
        except Exception as e:
            logger.error(f"Failed to upsert chunk {chunk_id}: {str(e)}")
            raise

    def query_clips(
        self,
        query_text: str,
        user_id: str,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """Query for relevant video clips"""
        query_embedding = self._generate_hardcoded_embedding(query_text)

        try:
            results = self.index.query(
                vector=query_embedding,
                top_k=top_k,
                namespace=self.namespace,
                filter={'user_id': user_id},
                include_metadata=True
            )

            clips = []
            for match in results.matches:
                clips.append({
                    'chunk_id': match.id,
                    'score': match.score,
                    'video_id': match.metadata.get('video_id'),
                    'chunk_index': match.metadata.get('chunk_index'),
                    'start_time': match.metadata.get('start_time'),
                    'end_time': match.metadata.get('end_time'),
                    'gcs_path': match.metadata.get('gcs_path'),
                    'description': match.metadata.get('description')
                })

            logger.info(f"Found {len(clips)} clips for query: {query_text}")
            return clips
        except Exception as e:
            logger.error(f"Failed to query clips: {str(e)}")
            raise

    def get_chunk_metadata(self, chunk_id: str) -> Dict[str, Any]:
        """Fetch metadata for a specific chunk"""
        try:
            results = self.index.fetch(
                ids=[chunk_id],
                namespace=self.namespace
            )

            if chunk_id not in results.vectors:
                raise ValueError(f"Chunk {chunk_id} not found")

            vector_data = results.vectors[chunk_id]
            return vector_data.metadata
        except Exception as e:
            logger.error(f"Failed to get chunk metadata: {str(e)}")
            raise

    def delete_video_chunks(self, user_id: str, video_id: str):
        """Delete all chunks for a given video from Pinecone"""
        try:
            query_embedding = self._generate_hardcoded_embedding()
            results = self.index.query(
                vector=query_embedding,
                top_k=10000,
                namespace=self.namespace,
                filter={
                    'user_id': user_id,
                    'video_id': video_id
                }
            )

            chunk_ids = [match.id for match in results.matches]

            if chunk_ids:
                self.index.delete(
                    ids=chunk_ids,
                    namespace=self.namespace
                )
                logger.info(f"Deleted {len(chunk_ids)} chunks from Pinecone")

        except Exception as e:
            logger.error(f"Failed to delete video chunks from Pinecone: {str(e)}")
            raise