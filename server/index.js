const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API endpoint to calculate playlist duration
app.post('/api/playlist-duration', async (req, res) => {
  const { playlistId } = req.body;

  try {
    let totalDuration = 0;
    let nextPageToken = '';
    let videoIds = []; // Store video IDs for each playlist item

    // Step 1: Fetch all video IDs from the playlist
    do {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
        params: {
          part: 'contentDetails',
          maxResults: 50,
          playlistId: playlistId,
          pageToken: nextPageToken,
          key: process.env.YOUTUBE_API_KEY
        }
      });

      // Collect video IDs
      response.data.items.forEach(item => {
        if (item.contentDetails && item.contentDetails.videoId) {
          videoIds.push(item.contentDetails.videoId);
        }
      });

      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    // Step 2: Fetch durations for each video ID in batches of 50 (API limit)
    for (let i = 0; i < videoIds.length; i += 50) {
      const videoIdBatch = videoIds.slice(i, i + 50).join(',');
      const videoResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          part: 'contentDetails',
          id: videoIdBatch,
          key: process.env.YOUTUBE_API_KEY
        }
      });

      // Sum durations for each video in this batch
      videoResponse.data.items.forEach(video => {
        const duration = video.contentDetails ? video.contentDetails.duration : null;
        if (duration) {
          totalDuration += convertToSeconds(duration);
        } else {
          console.warn('Warning: No duration found for video', video.id);
        }
      });
    }

    // Respond with the total formatted duration
    res.json({ totalDuration: formatDuration(totalDuration) });
  } catch (error) {
    console.error('API request error:', error.response ? error.response.data : error.message);
    res.status(500).json({ message: 'Error calculating playlist duration' });
  }
});

// Helper function to convert ISO 8601 duration to seconds
const convertToSeconds = (isoDuration) => {
  if (!isoDuration) return 0; // If duration is undefined or null, return 0 seconds
  const regex = /PT(\d+H)?(\d+M)?(\d+S)?/;
  const matches = isoDuration.match(regex);
  const hours = parseInt(matches[1] || 0) * 3600;
  const minutes = parseInt(matches[2] || 0) * 60;
  const seconds = parseInt(matches[3] || 0);
  return hours + minutes + seconds;
};

// Helper function to format seconds into HH:MM:SS
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  seconds = seconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
};

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
