type CryptoRandomSource = Pick<Crypto, 'getRandomValues'>;

const UINT32_RANGE = 0x1_0000_0000;

/** Creates an unbiased integer sampler, falling back only when Web Crypto is unavailable. */
export function createSecureRandomIndex(source: CryptoRandomSource | null | undefined = globalThis.crypto) {
  const value = new Uint32Array(1);

  return (exclusiveMax: number): number => {
    if (!Number.isSafeInteger(exclusiveMax) || exclusiveMax < 1 || exclusiveMax > UINT32_RANGE) {
      throw new RangeError('The random index range must be a positive safe integer.');
    }

    if (!source?.getRandomValues) return Math.floor(Math.random() * exclusiveMax);

    const unbiasedLimit = UINT32_RANGE - (UINT32_RANGE % exclusiveMax);
    do {
      source.getRandomValues(value);
    } while (value[0] >= unbiasedLimit);
    return value[0] % exclusiveMax;
  };
}
