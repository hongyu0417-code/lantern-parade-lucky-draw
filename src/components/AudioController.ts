/** Small, optional ceremonial cues. A context is created only after a user gesture. */
export class AudioController {
  private context: AudioContext | null = null;
  private muted = false;

  initialize(): void {
    if (this.context) return;
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return;
    try {
      this.context = new AudioContextConstructor();
      void this.context.resume().catch(() => undefined);
    } catch {
      this.context = null;
    }
  }

  setMuted(muted: boolean): void { this.muted = muted; }

  private tone(frequency: number, duration: number, startOffset = 0): void {
    if (!this.context || this.muted) return;
    try {
      const context = this.context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + startOffset;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.01);
    } catch {
      // Sound is optional. Browsers may suspend or deny an audio context.
    }
  }

  playSearchingCue(): void { this.tone(392, 0.32); }
  playWinnerCue(): void {
    this.tone(523.25, 0.75);
    this.tone(659.25, 0.8, 0.12);
    this.tone(783.99, 0.9, 0.24);
  }

  dispose(): void {
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }
}
