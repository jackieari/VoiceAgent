/**
 * Meeting Room - Multiple AI Participants
 */

class MeetingRoom {
  constructor() {
    // DOM elements
    this.statusOrb = document.getElementById('statusOrb');
    this.statusText = document.getElementById('statusText');
    this.conversation = document.getElementById('conversation');
    this.listenBtn = document.getElementById('listenBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.settingsToggle = document.getElementById('settingsToggle');
    this.settingsContent = document.getElementById('settingsContent');
    this.saveSettingsBtn = document.getElementById('saveSettings');
    this.participantElements = document.querySelectorAll('.participant');

    // Input elements
    this.voiceSelect = document.getElementById('voiceSelect');
    this.allRespondCheckbox = document.getElementById('allRespond');

    // API base URL
    this.apiBaseUrl = window.location.origin;

    // State
    this.isListening = false;
    this.isMeetingActive = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.conversationHistory = [];
    this.currentAudio = null;

    // Meeting participants
    this.participants = [
      {
        id: 1,
        name: 'Alex',
        role: 'Manager',
        emoji: '👨‍💼',
        voice: 'aura-orion-en',
        personality: 'You are Alex, a team manager. Focus on timelines and strategy. ALWAYS keep responses to 1-2 sentences maximum. Be brief and direct. Always end with a follow-up question to keep the conversation going.'
      },
      {
        id: 2,
        name: 'Sarah',
        role: 'Engineer',
        emoji: '👩‍💻',
        voice: 'aura-athena-en',
        personality: 'You are Sarah, a senior software engineer. Focus on technical points. ALWAYS keep responses to 1-2 sentences maximum. Be concise and technical. Always end with a follow-up question to keep the conversation going.'
      },
      {
        id: 3,
        name: 'Jordan',
        role: 'Designer',
        emoji: '👨‍🎨',
        voice: 'aura-arcas-en',
        personality: 'You are Jordan, a UX designer. Focus on user experience. ALWAYS keep responses to 1-2 sentences maximum. Be brief and design-focused. Always end with a follow-up question to keep the conversation going.'
      }
    ];

    // Load saved settings
    this.loadSettings();

    // Bind events
    this.bindEvents();
  }

  bindEvents() {
    // Click to start/stop meeting
    this.listenBtn.addEventListener('click', () => {
      if (this.isMeetingActive) {
        this.endMeeting();
      } else {
        this.startMeeting();
      }
    });

    // Stop button - interrupts everything
    this.stopBtn.addEventListener('click', () => {
      this.forceStop();
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
    this.baseVoice = localStorage.getItem('meetingVoice') || 'aura-asteria-en';
    this.allRespond = localStorage.getItem('allRespond') !== 'false';

    // Populate inputs
    this.voiceSelect.value = this.baseVoice;
    this.allRespondCheckbox.checked = this.allRespond;
  }

  saveSettings() {
    this.baseVoice = this.voiceSelect.value;
    this.allRespond = this.allRespondCheckbox.checked;

    localStorage.setItem('meetingVoice', this.baseVoice);
    localStorage.setItem('allRespond', this.allRespond);

    this.settingsContent.classList.remove('open');
    this.showStatus('ready', 'Settings saved');
  }

  showStatus(state, text) {
    this.statusOrb.className = 'status-orb ' + state;
    this.statusText.textContent = text;
  }

  addMessage(role, content, participantName = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const label = document.createElement('span');
    label.className = 'message-label';
    label.textContent = participantName || (role === 'user' ? 'You' : 'Assistant');

    const text = document.createElement('p');
    text.textContent = content;

    messageDiv.appendChild(label);
    messageDiv.appendChild(text);

    // Remove initial message if it exists
    const initialMsg = this.conversation.querySelector('.message.assistant p');
    if (initialMsg && initialMsg.textContent.includes('Welcome to the meeting room')) {
      this.conversation.innerHTML = '';
    }

    this.conversation.appendChild(messageDiv);
    this.conversation.scrollTop = this.conversation.scrollHeight;

    // Add to history
    this.conversationHistory.push({
      role: role,
      content: content,
      participant: participantName
    });

    // Keep history manageable
    if (this.conversationHistory.length > 30) {
      this.conversationHistory = this.conversationHistory.slice(-30);
    }
  }

  async startMeeting() {
    this.isMeetingActive = true;
    this.listenBtn.classList.add('active');
    this.listenBtn.querySelector('span').textContent = 'End meeting';
    this.stopBtn.style.display = 'flex';
    this.showStatus('listening', 'Listening...');
    await this.startListening();
  }

  endMeeting() {
    this.isMeetingActive = false;
    this.listenBtn.classList.remove('active');
    this.listenBtn.querySelector('span').textContent = 'Start meeting';
    this.stopBtn.style.display = 'none';
    if (this.isListening) {
      this.stopListening();
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.showStatus('ready', 'Ready');
  }

  forceStop() {
    // Stop any audio playing
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    // Stop listening
    if (this.isListening) {
      this.stopListening();
    }

    // Clear any timeouts
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }

    // Remove all participant highlights
    this.participantElements.forEach(el => {
      el.classList.remove('speaking');
    });

    // If in meeting mode, restart listening
    if (this.isMeetingActive) {
      setTimeout(async () => {
        if (this.isMeetingActive) {
          this.showStatus('listening', 'Listening...');
          await this.startListening();
        }
      }, 500);
    } else {
      this.showStatus('ready', 'Ready');
    }
  }

  async startListening() {
    if (this.isListening) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.isListening = true;
      this.showStatus('listening', 'Listening...');

      this.audioChunks = [];

      // Create audio context for silence detection
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      source.connect(analyzer);

      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      let lastSoundTime = Date.now();
      const silenceThreshold = 30;
      const silenceDuration = 10000; // Stop after 10 seconds of silence

      // Check for silence periodically
      const silenceChecker = setInterval(() => {
        analyzer.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

        if (average > silenceThreshold) {
          lastSoundTime = Date.now();
        } else {
          const silentFor = Date.now() - lastSoundTime;
          if (silentFor > silenceDuration && this.isListening) {
            clearInterval(silenceChecker);
            this.stopListening();
          }
        }
      }, 100);

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        clearInterval(silenceChecker);
        audioContext.close();
        stream.getTracks().forEach(track => track.stop());

        if (this.audioChunks.length > 0) {
          await this.processAudio();
        }
      };

      this.mediaRecorder.start(100);

      // Maximum recording time of 30 seconds
      this.silenceTimeout = setTimeout(() => {
        if (this.isListening) {
          clearInterval(silenceChecker);
          this.stopListening();
        }
      }, 30000);

    } catch (error) {
      console.error('Microphone error:', error);
      this.showStatus('error', 'Microphone access denied');
      this.isListening = false;
      this.isMeetingActive = false;
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
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

      // Convert to text
      const transcript = await this.speechToText(audioBlob);

      if (!transcript || transcript.trim() === '') {
        this.showStatus('ready', 'No speech detected');
        if (this.isMeetingActive) {
          await this.startListening();
        }
        return;
      }

      // Show user message
      this.addMessage('user', transcript, 'You');

      // Get responses from participants
      if (this.allRespond) {
        // All participants respond
        for (const participant of this.participants) {
          await this.getParticipantResponse(participant, transcript);
        }
      } else {
        // Random participant responds
        const randomParticipant = this.participants[Math.floor(Math.random() * this.participants.length)];
        await this.getParticipantResponse(randomParticipant, transcript);
      }

      // If in meeting mode, automatically restart listening
      if (this.isMeetingActive) {
        this.showStatus('listening', 'Listening...');
        await this.startListening();
      } else {
        this.showStatus('ready', 'Ready');
      }

    } catch (error) {
      console.error('Processing error:', error);
      this.showStatus('error', error.message || 'Error processing');

      if (this.isMeetingActive) {
        setTimeout(async () => {
          if (this.isMeetingActive) {
            await this.startListening();
          }
        }, 2000);
      }
    }
  }

  async getParticipantResponse(participant, userMessage) {
    try {
      // Highlight active participant
      this.highlightParticipant(participant.id);

      this.showStatus('processing', `${participant.name} is thinking...`);

      // Build context with recent conversation history including other participants
      const recentHistory = this.conversationHistory
        .slice(-10)
        .map(msg => {
          if (msg.role === 'user') {
            return { role: 'user', content: msg.content };
          } else {
            // Include which participant said what
            return { role: 'assistant', content: `${msg.participant}: ${msg.content}` };
          }
        });

      // Add the current user message if not already in history
      if (recentHistory.length === 0 || recentHistory[recentHistory.length - 1].content !== userMessage) {
        recentHistory.push({ role: 'user', content: userMessage });
      }

      // Enhanced personality prompt that considers other participants
      const contextualPrompt = `${participant.personality}

IMPORTANT: You are in a meeting with other participants. Previous responses from your colleagues are shown above. Build on what they said, reference their points, agree or politely disagree, and add your own perspective. Don't just repeat what others said - contribute something new from your unique role perspective.`;

      // Get AI response with full context
      const response = await this.getAIResponseWithContext(recentHistory, contextualPrompt);

      // Show participant message
      this.addMessage('assistant', response, `${participant.emoji} ${participant.name}`);

      // Speak the response
      this.showStatus('speaking', `${participant.name} is speaking...`);
      await this.textToSpeech(response, participant.voice);

      // Remove highlight
      this.removeHighlight(participant.id);

    } catch (error) {
      console.error(`Error getting response from ${participant.name}:`, error);
    }
  }

  highlightParticipant(id) {
    this.participantElements.forEach(el => {
      if (parseInt(el.dataset.id) === id) {
        el.classList.add('speaking');
      }
    });
  }

  removeHighlight(id) {
    this.participantElements.forEach(el => {
      if (parseInt(el.dataset.id) === id) {
        el.classList.remove('speaking');
      }
    });
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

  async getAIResponse(userMessage, systemPrompt) {
    const messages = [{ role: 'user', content: userMessage }];

    const response = await fetch(`${this.apiBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: messages,
        systemPrompt: systemPrompt
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "I'm not sure how to respond to that.";
  }

  async getAIResponseWithContext(messages, systemPrompt) {
    const response = await fetch(`${this.apiBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: messages,
        systemPrompt: systemPrompt
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "I'm not sure how to respond to that.";
  }

  async textToSpeech(text, voice) {
    const response = await fetch(`${this.apiBaseUrl}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, voice: voice || this.baseVoice })
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    // Store reference to current audio
    this.currentAudio = audio;

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        resolve();
      };
      audio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        reject(error);
      };
      audio.play().catch(error => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        reject(error);
      });
    });
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new MeetingRoom();
});
