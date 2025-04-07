require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/videos';
const YOUTUBE_SEARCH_API = 'https://www.googleapis.com/youtube/v3/search';

/**
 * YouTube → Song Info (title + artist)
 */
async function getYouTubeSongInfo(youtubeUrl) {
    const videoId = youtubeUrl.split("v=")[1]?.split("&")[0];
    if (!videoId) return null;

    try {
        const response = await axios.get(YOUTUBE_SEARCH_URL, {
            params: {
                key: process.env.YOUTUBE_API_KEY,
                id: videoId,
                part: 'snippet'
            }
        });

        const video = response.data.items[0];
        if (!video) return null;

        const title = video.snippet.title;
        const tags = video.snippet.tags;
        let artist = tags && tags.length > 0 ? tags[0] : video.snippet.channelTitle.replace(/ - Topic$/, '').trim();

        return `${title} ${artist}`;
    } catch (error) {
        console.error("YouTube API Error:", error.response?.data || error.message);
        return null;
    }
}

/**
 * Spotify → Song Info (title + artist)
 */
async function getSpotifySongInfo(spotifyUrl) {
    const trackId = spotifyUrl.split("/track/")[1]?.split("?")[0];
    if (!trackId) return null;

    try {
        const tokenRes = await axios.post(SPOTIFY_TOKEN_URL,
            new URLSearchParams({ grant_type: 'client_credentials' }),
            {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        const accessToken = tokenRes.data.access_token;

        const trackRes = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const name = trackRes.data.name;
        const artist = trackRes.data.artists[0].name;

        return `${name} ${artist}`;
    } catch (error) {
        console.error("Spotify API Error:", error.response?.data || error.message);
        return null;
    }
}

/**
 * Song Info → Spotify Link
 */
async function getSpotifyLink(songQuery) {
    try {
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
            params: { q: `"${songQuery}"`, type: 'track', limit: 1 }
        });

        const track = searchResponse.data.tracks.items[0];
        return track?.external_urls.spotify || null;
    } catch (error) {
        console.error("Spotify Search Error:", error.response?.data || error.message);
        return null;
    }
}

/**
 * Song Info → YouTube Music Link
 */
async function getYouTubeLink(songQuery) {
    try {
        const response = await axios.get(YOUTUBE_SEARCH_API, {
            params: {
                key: process.env.YOUTUBE_API_KEY,
                q: songQuery,
                part: 'snippet',
                type: 'video',
                videoCategoryId: 10, // music
                maxResults: 1
            }
        });

        const video = response.data.items[0];
        if (!video) return null;

        return `https://music.youtube.com/watch?v=${video.id.videoId}`;
    } catch (error) {
        console.error("YouTube Search Error:", error.response?.data || error.message);
        return null;
    }
}

/**
 * Smart Endpoint: YouTube <-> Spotify
 */
app.post('/convert-youtube', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        if (url.includes('music.youtube.com')) {
            console.log("🔁 YouTube → Spotify");
            const songQuery = await getYouTubeSongInfo(url);
            if (!songQuery) return res.status(400).json({ error: 'Invalid YouTube URL' });
            const spotifyLink = await getSpotifyLink(songQuery);
            return res.json({ type: "youtube-to-spotify", query: songQuery, spotifyLink });
        }

        if (url.includes('open.spotify.com')) {
            console.log("🔁 Spotify → YouTube");
            const songQuery = await getSpotifySongInfo(url);
            if (!songQuery) return res.status(400).json({ error: 'Invalid Spotify URL' });
            const youtubeLink = await getYouTubeLink(songQuery);
            return res.json({ type: "spotify-to-youtube", query: songQuery, youtubeLink });
        }

        return res.status(400).json({ error: 'Unsupported URL type' });
    } catch (error) {
        console.error("Convert Error:", error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Start the server
app.listen(3000, () => console.log(`🚀 Server running on port 3000`));