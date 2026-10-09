import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioController } from './AudioController';

afterEach(() => vi.unstubAllGlobals());

function fakeAudio() {
  const oscillators: Array<{ frequency: { value: number; setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
  const gains: Array<{ gain: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn>; cancelScheduledValues: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn> }; disconnect: ReturnType<typeof vi.fn> }> = [];
  const close = vi.fn().mockResolvedValue(undefined);
  class FakeAudioContext {
    currentTime = 0;
    destination = {};
    createOscillator = vi.fn(() => {
      const oscillator = { type: 'sine', frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
      oscillators.push(oscillator);
      return oscillator;
    });
    createGain = vi.fn(() => {
      const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
      gains.push(gain);
      return gain;
    });
    resume = vi.fn().mockResolvedValue(undefined);
    close = close;
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  return { oscillators, gains, close };
}

describe('AudioController', () => {
  it('is silent before initialization and tolerates absent Web Audio', () => {
    const audio = new AudioController();
    expect(() => audio.playLaunchCue()).not.toThrow();
    expect(() => audio.playAscentCue()).not.toThrow();
    expect(() => audio.initialize()).not.toThrow();
    expect(() => audio.dispose()).not.toThrow();
  });

  it('unlocks silently, starts ambience only during a draw, and plays distinct phase cues', () => {
    const { oscillators, gains } = fakeAudio();
    const audio = new AudioController();
    expect(oscillators).toHaveLength(0);
    audio.initialize();
    expect(oscillators).toHaveLength(0);
    audio.beginDraw();
    audio.startRunAmbience();
    expect(oscillators).toHaveLength(2);
    expect(gains[0].gain.setValueAtTime).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
    audio.playLaunchCue();
    audio.playAscentCue();
    audio.playFinalistsCue();
    audio.playSeparationCue();
    audio.playMagnifyCue();
    audio.playWinnerCue();
    expect(oscillators).toHaveLength(15);
    expect(oscillators[2].frequency.value).not.toBe(oscillators[3].frequency.value);
    audio.dispose();
  });

  it('immediately stops scheduled cues and ambient on mute, then resumes only ambient', () => {
    const { oscillators, gains } = fakeAudio();
    const audio = new AudioController();
    audio.initialize();
    audio.beginDraw();
    audio.startRunAmbience();
    audio.playWinnerCue();
    expect(oscillators).toHaveLength(5);
    audio.setMuted(true);
    expect(oscillators.every(({ stop, disconnect }) => stop.mock.calls.length > 0 && disconnect.mock.calls.length > 0)).toBe(true);
    expect(gains.every(({ disconnect }) => disconnect.mock.calls.length > 0)).toBe(true);
    audio.playFinalistsCue();
    expect(oscillators).toHaveLength(5);
    audio.setMuted(false);
    expect(oscillators).toHaveLength(7);
    expect(oscillators.slice(5).every(({ start }) => start.mock.calls.length === 1)).toBe(true);
    audio.dispose();
  });

  it('does not start ambient while muted and disposes all active nodes and context', () => {
    const { oscillators, gains, close } = fakeAudio();
    const audio = new AudioController();
    audio.setMuted(true);
    audio.initialize();
    expect(oscillators).toHaveLength(0);
    audio.beginDraw();
    audio.setMuted(false);
    expect(oscillators).toHaveLength(2);
    audio.dispose();
    expect(oscillators.every(({ stop, disconnect }) => stop.mock.calls.length > 0 && disconnect.mock.calls.length > 0)).toBe(true);
    expect(gains.every(({ disconnect }) => disconnect.mock.calls.length > 0)).toBe(true);
    expect(close).toHaveBeenCalledOnce();
  });

  it('plays each motion event once per draw and resets guards for the next draw', () => {
    const { oscillators } = fakeAudio();
    const audio = new AudioController();
    audio.initialize();
    audio.beginDraw();
    audio.onMotionEvent('burst');
    const afterFirstBurst = oscillators.length;
    audio.onMotionEvent('burst');
    expect(oscillators).toHaveLength(afterFirstBurst);

    audio.beginDraw();
    audio.onMotionEvent('burst');
    expect(oscillators).toHaveLength(afterFirstBurst + 3);
    audio.dispose();
  });

  it('plays one combined cue when the coordinated finalist exits begin', () => {
    const { oscillators } = fakeAudio();
    const audio = new AudioController();
    audio.initialize();
    audio.beginDraw();
    audio.onMotionEvent('losers-exit');
    const afterFirstExitCue = oscillators.length;
    audio.onMotionEvent('losers-exit');

    expect(afterFirstExitCue).toBe(1);
    expect(oscillators).toHaveLength(afterFirstExitCue);
    expect(oscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(145, 0.34);
    audio.dispose();
  });

  it('starts only one run ambience and stops it when the draw finishes', () => {
    const { oscillators } = fakeAudio();
    const audio = new AudioController();
    audio.initialize();
    audio.beginDraw();
    audio.startRunAmbience();
    const afterStart = oscillators.length;
    audio.startRunAmbience();
    expect(oscillators).toHaveLength(afterStart);

    audio.finishDraw();
    expect(oscillators.slice(-2).every(({ stop }) => stop.mock.calls.length > 0)).toBe(true);
    audio.dispose();
  });
});
