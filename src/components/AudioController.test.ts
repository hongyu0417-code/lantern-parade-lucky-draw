import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioController } from './AudioController';

afterEach(() => vi.unstubAllGlobals());

describe('AudioController', () => {
  it('is silent before initialization, respects mute, and tolerates absent Web Audio', () => {
    const audio = new AudioController();
    expect(() => audio.playSearchingCue()).not.toThrow();
    expect(() => audio.initialize()).not.toThrow();
    audio.setMuted(true);
    expect(() => audio.playWinnerCue()).not.toThrow();
    expect(() => audio.dispose()).not.toThrow();
  });

  it('plays low-volume cues after initialization and mutes subsequent cues', () => {
    const start = vi.fn();
    const createOscillator = vi.fn(() => ({ type: 'sine', frequency: { value: 0 }, connect: vi.fn(), start, stop: vi.fn() }));
    const createGain = vi.fn(() => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }));
    class FakeAudioContext {
      currentTime = 0;
      destination = {};
      createOscillator = createOscillator;
      createGain = createGain;
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const audio = new AudioController();
    audio.initialize();
    audio.playSearchingCue();
    expect(start).toHaveBeenCalledOnce();
    audio.setMuted(true);
    audio.playWinnerCue();
    expect(start).toHaveBeenCalledOnce();
    audio.setMuted(false);
    audio.playWinnerCue();
    expect(start).toHaveBeenCalledTimes(4);
    audio.dispose();
  });
});
