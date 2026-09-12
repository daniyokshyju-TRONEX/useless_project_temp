// ============================================================================
// UNPREDICTABLE - Web Audio Synthesizer
// Pure procedural Web Audio API sound effects with zero external audio assets.
// ============================================================================

export class AudioManager {
  constructor() {
    this.context = null;
    this.enabled = true;
    this.accuracyAudio = new Audio('assets/2st.mp3.mpeg');
    this.lifeLostAudio = new Audio('assets/1st.mp3.mpeg');
    this.accuracyAudio.preload = 'auto';
    this.lifeLostAudio.preload = 'auto';
    this.accuracyAudio.volume = 1;
    this.lifeLostAudio.volume = 1;
    this.accuracyAudio.addEventListener('error', () => {
      console.warn('Missing audio file: assets/2st.mp3.mpeg');
    });
    this.lifeLostAudio.addEventListener('error', () => {
      console.warn('Missing audio file: assets/1st.mp3.mpeg');
    });
  }

  playFile(audio, fallback) {
    if (!this.enabled || !audio) return;

    try {
      this.unlock();
      if (audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        fallback();
        return;
      }
      audio.currentTime = 0;
      const playback = audio.play();
      if (playback?.catch) playback.catch(fallback);
    } catch (err) {
      fallback();
    }
  }

  accuracyDepleted() {
    const fallback = () => this.tone(130, 0.25, 'sawtooth', 0.05);
    if (this.accuracyAudio.error) return fallback();
    this.playFile(this.accuracyAudio, fallback);
  }

  lifeLost() {
    const fallback = () => {
      this.tone(160, 0.35, 'sawtooth', 0.08, 40);
      this.tone(90, 0.25, 'square', 0.06, 30);
    };
    if (this.lifeLostAudio.error) return fallback();
    this.playFile(this.lifeLostAudio, fallback);
  }

  // Safely initialize / resume AudioContext on user interaction
  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.context = new AudioCtx();
        }
      }
      if (this.context && this.context.state === 'suspended') {
        this.context.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('Web Audio not supported or blocked:', e);
    }
  }

  // Play a procedural synthesized tone
  tone(frequency, duration = 0.08, type = 'sine', volume = 0.04, freqEnd = null) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.context) return;

    try {
      const now = this.context.currentTime;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      if (freqEnd !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), now + duration);
      }

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.context.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (err) {
      // Audio errors should never crash gameplay
    }
  }

  // Player step movement
  movement() {
    this.tone(190, 0.035, 'triangle', 0.02, 130);
  }

  // Key collection chime
  key() {
    this.tone(587.33, 0.12, 'sine', 0.05); // D5
    setTimeout(() => this.tone(880, 0.2, 'triangle', 0.04), 80); // A5
    setTimeout(() => this.tone(1174.66, 0.28, 'sine', 0.03), 160); // D6
  }

  // Lethal trap activation / damage
  trap() {
    this.tone(160, 0.35, 'sawtooth', 0.08, 40);
    this.tone(90, 0.25, 'square', 0.06, 30);
  }

  // Subtle trap trigger or crumbling floor warning
  trapTrigger() {
    this.tone(340, 0.06, 'sine', 0.03, 180);
  }

  // Glitch / Control change mutation sound
  control() {
    this.tone(420, 0.1, 'square', 0.04, 210);
    setTimeout(() => this.tone(630, 0.14, 'sawtooth', 0.035, 140), 60);
  }

  // Checkpoint reached
  checkpoint() {
    this.tone(440, 0.12, 'sine', 0.04);
    setTimeout(() => this.tone(659.25, 0.22, 'sine', 0.035), 90);
  }

  // Level cleared
  complete() {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.tone(freq, 0.24, 'sine', 0.04), idx * 110);
    });
  }

  // Game Over: The Maze Won
  gameOver() {
    this.tone(180, 0.5, 'sawtooth', 0.07, 45);
    setTimeout(() => this.tone(130, 0.6, 'sawtooth', 0.06, 30), 200);
  }

  // Glitch burst
  glitch() {
    this.tone(320, 0.08, 'square', 0.05, 80);
    setTimeout(() => this.tone(520, 0.08, 'sawtooth', 0.04, 90), 40);
  }

  // Toggle mute
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}
