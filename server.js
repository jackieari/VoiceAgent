/**
 * Voice Agent Backend Server
 * Handles API calls securely with environment variables
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'audio/webm', limit: '10mb' }));
app.use(express.static('.')); // Serve static files from current directory

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Speech to Text endpoint
app.post('/api/stt', async (req, res) => {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Deepgram API key not configured' });
    }

    const response = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'audio/webm'
        },
        body: req.body
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Deepgram STT error:', error);
      return res.status(response.status).json({ error: 'STT failed' });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('STT error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI response endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const { messages, systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Add system message at the beginning
    const openaiMessages = [
      {
        role: 'system',
        content: systemPrompt || 'You are a helpful voice assistant.'
      },
      ...messages
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages: openaiMessages
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return res.status(response.status).json({ error: 'AI request failed' });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Text to Speech endpoint
app.post('/api/tts', async (req, res) => {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Deepgram API key not configured' });
    }

    const { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const voiceModel = voice || 'aura-asteria-en';

    const response = await fetch(
      `https://api.deepgram.com/v1/speak?model=${voiceModel}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Deepgram TTS error:', error);
      return res.status(response.status).json({ error: 'TTS failed' });
    }

    // Stream the audio response
    res.setHeader('Content-Type', 'audio/mpeg');
    response.body.pipe(res);

  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Voice Agent server running on http://localhost:${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/*`);
});
