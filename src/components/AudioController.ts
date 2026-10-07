type Voice = { oscillator: OscillatorNode; gain: GainNode };

/** Quiet synthesized ambience and ceremonial cues, created after a user gesture. */
export class AudioController {
  private context: AudioContext | null = null;
  private muted = false;
  private active = new Set<Voice>();
  private ambient = new Set<Voice>();

  initialize(): void {
    if (this.context) return;
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return;
    try {
      this.context = new AudioContextConstructor();
      void this.context.resume().catch(() => undefined);
      this.startAmbient();
    } catch {
      this.context = null;
    }
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    if (muted) this.stopAll();
    else this.startAmbient();
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
  }

  private voice(frequency: number, volume: number, duration?: number, startOffset = 0): void {
    if (!this.context || this.muted) return;
    try {
      const context = this.context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + startOffset;
      const voice = { oscillator, gain };
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      if (duration === undefined) {
        gain.gain.setValueAtTime(volume, start);
        this.ambient.add(voice);
      } else {
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      }
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => this.release(voice);
      oscillator.start(start);
      if (duration !== undefined) oscillator.stop(start + duration + 0.01);
      this.active.add(voice);
    } catch {
      // Sound is optional. Browsers may suspend or deny an audio context.
    }
  }

  private startAmbient(): void {
    if (!this.context || this.muted || this.ambient.size > 0) return;
    this.voice(110, 0.0035);
    this.voice(164.81, 0.0025);
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
    this.voice(349.23, 0.032, 0.32);
    this.voice(523.25, 0.032, 0.4, 0.09);
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

  dispose(): void {
    this.stopAll();
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }
}
