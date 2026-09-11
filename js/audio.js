export class AudioManager {
  constructor() { this.context = null; this.enabled = true; }
  unlock() { if (!this.enabled) return; if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)(); if (this.context.state === 'suspended') this.context.resume(); }
  tone(frequency, duration = .08, type = 'sine', volume = .035) {
    if (!this.enabled) return; this.unlock(); if (!this.context) return;
    const oscillator = this.context.createOscillator(); const gain = this.context.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(volume, this.context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, this.context.currentTime + duration);
    oscillator.connect(gain).connect(this.context.destination); oscillator.start(); oscillator.stop(this.context.currentTime + duration);
  }
  movement() { this.tone(170, .045, 'triangle', .025); }
  key() { this.tone(620, .1, 'sine', .045); setTimeout(() => this.tone(920, .16, 'sine', .03), 70); }
  trap() { this.tone(90, .28, 'sawtooth', .05); }
  control() { this.tone(260, .12, 'square', .028); setTimeout(() => this.tone(130, .2, 'square', .02), 90); }
  checkpoint() { this.tone(410, .12, 'sine', .03); }
  complete() { [440, 554, 659].forEach((tone, i) => setTimeout(() => this.tone(tone, .18, 'sine', .035), i * 100)); }
  gameOver() { this.tone(110, .45, 'sawtooth', .04); }
  toggle() { this.enabled = !this.enabled; return this.enabled; }
}
