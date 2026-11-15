/**
 * strechat - Text To Speech (TTS) Engine
 * Optional speech synthesizer for gifts and pinned messages using Web Speech API.
 */

class TTSEngine {
  constructor() {
    this.enabled = false;
    this.readGifts = true;
    this.readChats = false;
    this.volume = 0.8;
    this.rate = 1.0;
    this.synth = window.speechSynthesis;
    this.voice = null;

    if (this.synth) {
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this._loadVoices();
      }
      this._loadVoices();
    }
  }

  _loadVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    // Prioritize Indonesian or English voices
    this.voice = voices.find(v => v.lang.startsWith('id')) ||
                 voices.find(v => v.lang.startsWith('en')) ||
                 voices[0] || null;
  }

  speak(text) {
    if (!this.enabled || !this.synth || !text) return;

    try {
      // Avoid long queues: cancel old utterances if lagging
      if (this.synth.speaking) {
        this.synth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.voice) utterance.voice = this.voice;
      utterance.volume = this.volume;
      utterance.rate = this.rate;

      this.synth.speak(utterance);
    } catch (e) {
      console.warn('[strechat] TTS error:', e);
    }
  }

  speakGift(sender, giftName, count = 1) {
    if (!this.enabled || !this.readGifts) return;
    const msg = count > 1 ? `${sender} kirim ${count} ${giftName}` : `${sender} kirim ${giftName}`;
    this.speak(msg);
  }
}

window.ttsEngine = new TTSEngine();
