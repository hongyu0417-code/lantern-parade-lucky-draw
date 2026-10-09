type Voice = { oscillator: OscillatorNode; gain: GainNode; volume: number; ambient: boolean };

export type LanternAudioEvent =
  | 'launch'
  | 'running'
  | 'space-stop'
  | 'finalists3'
  | 'losers-exit'
  | 'winner-enlargement'
  | 'charge'
  | 'burst'
  | 'reveal';

/** Quiet synthesized ambience and one-shot cues prepared after a user gesture. */
export class AudioController {
  private context: AudioContext | null = null;
  private muted = false;
  private drawActive = false;
  private tension: 0 | 1 | 2 = 0;
  private active = new Set<Voice>();
  private ambient = new Set<Voice>();
  private playedEvents = new Set<LanternAudioEvent>();

  initialize(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
      return;
    }
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return;
    try {
      this.context = new AudioContextConstructor({ latencyHint: 'interactive' });
      void this.context.resume().catch(() => undefined);
    } catch {
      this.context = null;
    }
  }

  beginDraw(): void {
    this.drawActive = true;
    this.tension = 0;
    this.playedEvents.clear();
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    if (muted) this.stopAll();
    else if (this.drawActive) this.startRunAmbience();
  }

  private release(voice: Voice): void {
    if (!this.active.delete(voice)) return;
    this.ambient.delete(voice);
    voice.oscillator.disconnect();
    voice.gain.disconnect();
  }

  private stopAll(): void {
    for (const voice of [...this.active]) {
      try { voice.oscillator.stop(); } catch { /* The node may already have ended. */ }
      this.release(voice);
    }
    this.ambient.clear();
  }

  private voice(frequency: number, volume: number, duration?: number, startOffset = 0, ambient = false): void {
    if (!this.context || this.muted) return;
    try {
      const context = this.context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + startOffset;
      const voice = { oscillator, gain, volume, ambient };
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      if (ambient) {
        gain.gain.setValueAtTime(volume, start);
      } else {
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + (duration ?? 0.4));
      }
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => this.release(voice);
      oscillator.start(start);
      if (duration !== undefined) oscillator.stop(start + duration + 0.01);
      this.active.add(voice);
      if (ambient) this.ambient.add(voice);
    } catch {
      // Sound is optional. Browsers may suspend or deny an audio context.
    }
  }

  startRunAmbience(): void {
    if (!this.drawActive || !this.context || this.muted || this.ambient.size > 0) return;
    this.voice(110, 0.0024, undefined, 0, true);
    this.voice(164.81, 0.0017, undefined, 0, true);
    this.setTension(this.tension);
  }

  setTension(level: 0 | 1 | 2): void {
    this.tension = level;
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    const multiplier = 1 + level * 0.12;
    for (const voice of this.ambient) {
      voice.gain.gain.setValueAtTime(voice.volume * multiplier, now);
    }
  }

  private stopRunAmbience(): void {
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    for (const voice of [...this.ambient]) {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.volume * (1 + this.tension * 0.12), now);
        voice.gain.gain.linearRampToValueAtTime(0.0001, now + 0.45);
        voice.oscillator.stop(now + 0.46);
      } catch {
        try { voice.oscillator.stop(); } catch { /* The voice has already ended. */ }
        this.release(voice);
      }
    }
    this.ambient.clear();
  }

  finishDraw(): void {
    this.drawActive = false;
    this.tension = 0;
    this.stopRunAmbience();
  }

  onMotionEvent(event: LanternAudioEvent): void {
    if (this.playedEvents.has(event)) return;
    this.playedEvents.add(event);
    switch (event) {
      case 'launch': this.playLaunchCue(); break;
      case 'running': this.startRunAmbience(); this.playAscentCue(); break;
      case 'space-stop': this.playStopCue(); break;
      case 'finalists3': this.setTension(1); break;
      case 'losers-exit': this.setTension(2); this.playExitWhoosh(); break;
      case 'winner-enlargement': this.playMagnifyCue(); break;
      case 'charge': this.playChargeCue(); break;
      case 'burst': this.playBurstCue(); break;
      case 'reveal': this.finishDraw(); this.playWinnerCue(); break;
    }
  }

  playLaunchCue(): void {
    this.voice(196, 0.035, 0.42);
    this.voice(293.66, 0.028, 0.52, 0.08);
  }
  playAscentCue(): void {
    this.voice(392, 0.032, 0.46);
    this.voice(523.25, 0.028, 0.48, 0.18);
  }
  playFinalistsCue(): void {
    this.voice(440, 0.035, 0.38);
    this.voice(659.25, 0.04, 0.52, 0.14);
  }
  playSeparationCue(): void {
    this.voice(349.23, 0.024, 0.32);
    this.voice(523.25, 0.024, 0.4, 0.09);
  }
  playExitWhoosh(): void {
    if (!this.context || this.muted) return;
    try {
      const context = this.context;
      const start = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const voice = { oscillator, gain, volume: 0.026, ambient: false };
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(480, start);
      oscillator.frequency.exponentialRampToValueAtTime(145, start + 0.34);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.026, start + 0.045);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => this.release(voice);
      oscillator.start(start);
      oscillator.stop(start + 0.39);
      this.active.add(voice);
    } catch {
      // Sound is optional. Browsers may suspend or deny an audio context.
    }
  }
  playMagnifyCue(): void {
    this.voice(392, 0.04, 0.32);
    this.voice(587.33, 0.046, 0.42, 0.1);
  }
  playChargeCue(): void {
    this.voice(440, 0.028, 0.36);
    this.voice(659.25, 0.035, 0.3, 0.16);
  }
  playBurstCue(): void {
    this.voice(329.63, 0.06, 0.3);
    this.voice(523.25, 0.055, 0.38, 0.04);
    this.voice(783.99, 0.048, 0.46, 0.11);
  }
  playWinnerCue(): void {
    this.voice(523.25, 0.055, 0.75);
    this.voice(659.25, 0.055, 0.8, 0.12);
    this.voice(783.99, 0.055, 0.9, 0.24);
  }
  playStopCue(): void {
    this.voice(246.94, 0.014, 0.28);
    this.voice(369.99, 0.012, 0.34, 0.08);
  }

  dispose(): void {
    this.stopAll();
    this.drawActive = false;
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }
}
