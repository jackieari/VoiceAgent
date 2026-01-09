/**
 * Voice Agent - Deepgram STT/TTS + Claude AI
 */

class VoiceAgent {
  constructor() {
    // DOM elements
    this.statusOrb = document.getElementById('statusOrb');
    this.statusText = document.getElementById('statusText');
    this.conversation = document.getElementById('conversation');
    this.listenBtn = document.getElementById('listenBtn');
    this.settingsToggle = document.getElementById('settingsToggle');
    this.settingsContent = document.getElementById('settingsContent');
    this.saveSettingsBtn = document.getElementById('saveSettings');

    // Input elements
    this.voiceSelect = document.getElementById('voiceSelect');
    this.systemPromptInput = document.getElementById('systemPrompt');

    // API base URL
    this.apiBaseUrl = window.location.origin;

    // State
    this.isListening = false;
    this.isConversationMode = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.conversationHistory = [];

    // Load saved settings
    this.loadSettings();

    // Bind events
    this.bindEvents();
  }

  bindEvents() {
    // Click to start/stop conversation
    this.listenBtn.addEventListener('click', () => {
      if (this.isConversationMode) {
        this.endConversation();
      } else {
        this.startConversation();
      }
    });

    // Settings
    this.settingsToggle.addEventListener('click', () => {
      this.settingsContent.classList.toggle('open');
    });

    this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());

    // Close settings when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.settingsContent.contains(e.target) &&
          !this.settingsToggle.contains(e.target)) {
        this.settingsContent.classList.remove('open');
      }
    });
  }

  loadSettings() {
    this.voice = localStorage.getItem('voice') || 'aura-asteria-en';
    this.systemPrompt = localStorage.getItem('systemPrompt') ||
      'You are a helpful voice assistant. Keep your responses concise and conversational since they will be spoken aloud. Aim for 2-3 sentences unless the user asks for more detail.';

    // Populate inputs
    this.voiceSelect.value = this.voice;
    this.systemPromptInput.value = this.systemPrompt;
  }

  saveSettings() {
    this.voice = this.voiceSelect.value;
    this.systemPrompt = this.systemPromptInput.value.trim();

    localStorage.setItem('voice', this.voice);
    localStorage.setItem('systemPrompt', this.systemPrompt);

    this.settingsContent.classList.remove('open');
    this.showStatus('ready', 'Settings saved');
  }

  showStatus(state, text) {
    this.statusOrb.className = 'status-orb ' + state;
    this.statusText.textContent = text;
  }

  addMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const label = document.createElement('span');
    label.className = 'message-label';
    label.textContent = role === 'user' ? 'You' : 'Agent';

    const content = document.createElement('p');
    content.textContent = text;

    messageDiv.appendChild(label);
    messageDiv.appendChild(content);
    this.conversation.appendChild(messageDiv);

    // Scroll to bottom
    this.conversation.scrollTop = this.conversation.scrollHeight;

    // Add to history for context
    this.conversationHistory.push({ role, content: text });

    // Keep history manageable (last 10 exchanges)
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
  }

  async startConversation() {
    this.isConversationMode = true;
    this.listenBtn.classList.add('active');
    this.listenBtn.querySelector('span').textContent = 'Stop conversation';
    this.showStatus('listening', 'Listening...');
    await this.startListening();
  }

  endConversation() {
    this.isConversationMode = false;
    this.listenBtn.classList.remove('active');
    this.listenBtn.querySelector('span').textContent = 'Start conversation';
    if (this.isListening) {
      this.stopListening();
    }
    this.showStatus('ready', 'Ready');
  }

  async startListening() {
    if (this.isListening) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.isListening = true;
      this.showStatus('listening', 'Listening...');

      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        if (this.audioChunks.length > 0) {
          await this.processAudio();
        }
      };

      this.mediaRecorder.start(100);

      // Auto-stop after 5 seconds
      this.silenceTimeout = setTimeout(() => {
        if (this.isListening) {
          this.stopListening();
        }
      }, 5000);

    } catch (error) {
      console.error('Microphone error:', error);
      this.showStatus('error', 'Microphone access denied');
      this.isListening = false;
      this.isConversationMode = false;
    }
  }

  stopListening() {
    if (!this.isListening || !this.mediaRecorder) return;

    this.isListening = false;
    this.showStatus('processing', 'Processing...');

    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }

    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  async processAudio() {
    try {
      // Create audio blob
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

      // Convert to text using Deepgram
      const transcript = await this.speechToText(audioBlob);

      if (!transcript || transcript.trim() === '') {
        this.showStatus('ready', 'No speech detected');
        // If in conversation mode, restart listening
        if (this.isConversationMode) {
          await this.startListening();
        }
        return;
      }

      // Show user message
      this.addMessage('user', transcript);

      // Get AI response
      this.showStatus('processing', 'Thinking...');
      const response = await this.getAIResponse(transcript);

      // Show assistant message
      this.addMessage('assistant', response);

      // Speak the response
      this.showStatus('speaking', 'Speaking...');
      await this.textToSpeech(response);

      // If in conversation mode, automatically restart listening
      if (this.isConversationMode) {
        this.showStatus('listening', 'Listening...');
        await this.startListening();
      } else {
        this.showStatus('ready', 'Ready');
      }

    } catch (error) {
      console.error('Processing error:', error);
      this.showStatus('error', error.message || 'Error processing');

      // If in conversation mode and error occurred, restart listening
      if (this.isConversationMode) {
        setTimeout(async () => {
          if (this.isConversationMode) {
            await this.startListening();
          }
        }, 2000);
      }
    }
  }

  async speechToText(audioBlob) {
    const response = await fetch(`${this.apiBaseUrl}/api/stt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/webm'
      },
      body: audioBlob
    });

    if (!response.ok) {
      throw new Error(`STT failed: ${response.status}`);
    }

    const data = await response.json();
    return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  }

  async getAIResponse(userMessage) {
    // Build messages with history
    const messages = this.conversationHistory
      .slice(-10) // Last 5 exchanges
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

    // Ensure last message is user's current message
    if (messages.length === 0 || messages[messages.length - 1].content !== userMessage) {
      messages.push({ role: 'user', content: userMessage });
    }

    const response = await fetch(`${this.apiBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: messages,
        systemPrompt: this.systemPrompt
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "I'm not sure how to respond to that.";
  }

  async textToSpeech(text) {
    const response = await fetch(`${this.apiBaseUrl}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, voice: this.voice })
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.status}`);
    }

    // Get audio and play it
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = reject;
      audio.play();
    });
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.voiceAgent = new VoiceAgent();
});
