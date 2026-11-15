/**
 * strechat - Web Audio Synthesizer
 * Zero-asset, zero-latency procedural sound generation for gifts and alerts.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.5;
  }

  _initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playGiftChime(intensity = 1) {
    if (!this.enabled) return;
    this._initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(this.volume * 0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      gainNode.connect(this.ctx.destination);

      // Play pleasant two-tone or three-tone harmonic chime
      const baseFreq = 587.33; // D5
      const notes = intensity > 2 ? [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2] : [baseFreq, baseFreq * 1.5];

      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        osc.connect(gainNode);
        osc.start(now + idx * 0.08);
        osc.stop(now + 0.6);
      });
    } catch (e) {
      console.warn('[strechat] Audio error:', e);
    }
  }

  playMilestone() {
    if (!this.enabled) return;
    this._initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(this.volume * 0.4, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      gainNode.connect(this.ctx.destination);

      // Fanfare arpeggio: C5, E5, G5, C6
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        osc.connect(gainNode);
        osc.start(now + i * 0.1);
        osc.stop(now + 0.8);
      });
    } catch (e) {}
  }
}

window.soundEngine = new SoundEngine();
