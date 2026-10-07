import { describe, expect, it, vi } from 'vitest';
import { createSecureRandomIndex } from '../../src/draw/random';

describe('secure random index', () => {
  it('uses Web Crypto and rejects the biased remainder before returning an index', () => {
    const values = [0xffff_ffff, 17];
    const getRandomValues = vi.fn((buffer: Uint32Array) => {
      buffer[0] = values.shift()!;
      return buffer;
    });
    const randomIndex = createSecureRandomIndex({ getRandomValues });

    expect(randomIndex(10)).toBe(7);
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it('falls back to a bounded Math.random index when Web Crypto is unavailable', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9999);
    expect(createSecureRandomIndex(null)(3)).toBe(2);
  });

  it('rejects empty and unreasonably large index ranges', () => {
    const randomIndex = createSecureRandomIndex({ getRandomValues: (buffer) => buffer });
    expect(() => randomIndex(0)).toThrow(RangeError);
    expect(() => randomIndex(0x1_0000_0001)).toThrow(RangeError);
  });
});
