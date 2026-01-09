# Voice Agent

A voice-powered AI assistant using Deepgram for speech-to-text/text-to-speech and OpenAI GPT-4 for intelligent responses.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit [.env](.env) and add your API keys:
   ```
   DEEPGRAM_API_KEY=your_deepgram_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   ```

### 3. Get API Keys

- **Deepgram API Key**: Sign up at [https://deepgram.com](https://deepgram.com)
- **OpenAI API Key**: Sign up at [https://platform.openai.com](https://platform.openai.com)

### 4. Run the Server

```bash
npm start
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Features

- Hold-to-talk voice interface
- Real-time speech-to-text using Deepgram
- AI-powered responses from OpenAI GPT-4
- Text-to-speech output with multiple voice options
- Conversation history context
- Customizable system prompts

## Security

API keys are now stored securely in the [.env](.env) file on the server side and are never exposed to the frontend. The [.gitignore](.gitignore) file ensures your [.env](.env) file is never committed to version control.

## Usage

1. Open the application in your browser
2. Click and hold the microphone button (or press spacebar)
3. Speak your question or message
4. Release to send
5. The AI will respond with both text and voice

Configure voice and system prompt in the settings panel (gear icon).
# VoiceAgent
