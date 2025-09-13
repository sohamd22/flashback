'use client';

import { useState } from 'react';

interface VideoClip {
  chunk_id: string;
  score: number;
  user_id: string;
  video_id: string;
  url: string;
  originalUrl: string;
  expires_at: string;
}

interface QueryResponse {
  user_id: string;
  query: string;
  clips: VideoClip[];
}

export default function TestQueryPage() {
  const [userId, setUserId] = useState('');
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<QueryResponse | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  // Memory creation states
  const [showMemoryUpload, setShowMemoryUpload] = useState(false);
  const [uploadUserId, setUploadUserId] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId || !query) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);
    setSelectedVideo(null);

    try {
      const response = await fetch('/api/test-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          query,
          topK,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to query videos');
      }

      const data = await response.json();
      setResults(data);

      // Auto-select first video if available
      if (data.clips && data.clips.length > 0) {
        setSelectedVideo(data.clips[0].url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!uploadUserId || !videoFile) {
      setError('Please provide user ID and select a video file');
      return;
    }

    setUploadLoading(true);
    setError('');
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append('userId', uploadUserId);
      formData.append('video', videoFile);

      const response = await fetch('/api/process-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload video');
      }

      const data = await response.json();
      setUploadSuccess(`Video uploaded successfully! Video ID: ${data.video_id}`);
      setVideoFile(null);

      // Reset file input
      const fileInput = document.getElementById('video-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload video');
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-light">Video Query Test</h1>
          <button
            onClick={() => setShowMemoryUpload(!showMemoryUpload)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            {showMemoryUpload ? 'Search Videos' : 'Create Memory'}
          </button>
        </div>

        {/* Memory Upload Form */}
        {showMemoryUpload ? (
          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-medium mb-4">Upload Video Memory</h2>
            <form onSubmit={handleVideoUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  value={uploadUserId}
                  onChange={(e) => setUploadUserId(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-gray-500"
                  placeholder="Enter user ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Video File
                </label>
                <input
                  id="video-upload"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-700 file:text-white hover:file:bg-gray-600"
                />
                {videoFile && (
                  <p className="mt-2 text-sm text-gray-400">
                    Selected: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={uploadLoading}
                className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploadLoading ? 'Uploading...' : 'Upload & Embed Video'}
              </button>
            </form>

            {uploadSuccess && (
              <div className="mt-4 p-3 bg-green-900/50 border border-green-700 rounded-lg text-green-300">
                {uploadSuccess}
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
                {error}
              </div>
            )}
          </div>
        ) : (
          /* Query Form */
          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                User ID
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-gray-500"
                placeholder="Enter user ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Search Query
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-gray-500"
                placeholder="Enter your search query"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Number of Results (Top K)
              </label>
              <input
                type="number"
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value) || 5)}
                min="1"
                max="20"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-gray-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Searching...' : 'Search Videos'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
              {error}
            </div>
          )}
        </div>
        )}

        {/* Results Section */}
        {!showMemoryUpload && results && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-medium mb-4">
                Results for "{results.query}" ({results.clips.length} clips found)
              </h2>

              {/* Video Player */}
              {selectedVideo && (
                <div className="mb-6">
                  <div className="bg-black rounded-lg overflow-hidden">
                    <video
                      key={selectedVideo}
                      controls
                      autoPlay
                      className="w-full max-h-[500px]"
                      src={selectedVideo}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              )}

              {/* Clips Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.clips.map((clip) => (
                  <div
                    key={clip.chunk_id}
                    className={`bg-gray-800 rounded-lg p-4 cursor-pointer transition-all hover:bg-gray-700 ${
                      selectedVideo === clip.url ? 'ring-2 ring-white' : ''
                    }`}
                    onClick={() => setSelectedVideo(clip.url)}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-gray-400">
                          {clip.chunk_id.slice(0, 8)}...
                        </span>
                        <span className="text-xs px-2 py-1 bg-green-900/50 text-green-300 rounded">
                          Score: {(clip.score * 100).toFixed(1)}%
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Video ID: {clip.video_id.slice(0, 12)}...</div>
                        <div>User: {clip.user_id}</div>
                      </div>

                      <button
                        className="w-full mt-2 py-1 px-2 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVideo(clip.url);
                        }}
                      >
                        Play Video
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {results.clips.length === 0 && (
                <p className="text-gray-500 text-center py-8">
                  No video clips found for this query.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}