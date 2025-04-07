require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/videos';

async function getYouTubeSongInfo(youtubeUrl) {
    const videoId = youtubeUrl.split("v=")[1]?.split("&")[0];
    if (!videoId) return null;

    const response = await axios.get(YOUTUBE_SEARCH_URL, {
        params: {
            key: process.env.YOUTUBE_API_KEY,
            id: videoId,
            part: 'snippet'
        }
    });

    const video = response.data.items[0];
    if (!video) return null;

    return video.snippet.title;
}

async function getSpotifyLink(songQuery) {
    const authResponse = await axios.post(SPOTIFY_TOKEN_URL, 
        new URLSearchParams({ grant_type: 'client_credentials' }),
        {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );
    const accessToken = authResponse.data.access_token;

    const searchResponse = await axios.get(`https://api.spotify.com/v1/search`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        params: { q: songQuery, type: 'track', limit: 1 }
    });

    return searchResponse.data.tracks.items[0]?.external_urls.spotify;
}

app.post('/convert-youtube', async (req, res) => {
    const { youtubeUrl } = req.body;
    if (!youtubeUrl) return res.status(400).json({ error: 'YouTube URL is required' });

    try {
        const songQuery = await getYouTubeSongInfo(youtubeUrl);
        if (!songQuery) return res.status(400).json({ error: 'Invalid YouTube URL' });

        const spotifyLink = await getSpotifyLink(songQuery);
        res.json({ spotifyLink });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
