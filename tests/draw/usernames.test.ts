import { describe, expect, it } from 'vitest';
import { getDisplayUsername, usesCompactUsernameTypography } from '../../src/draw/usernames';

describe('getDisplayUsername', () => {
  it.each([
    ['@abc', '@abc'],
    ['@hongyu814__', '@hongyu81…'],
    ['@thisisaverylongusername', '@thisisav…'],
    ['@123456789012345678901234567890', '@12345678…'],
    ['hongyu814__', 'hongyu814…'],
  ])('turns %s into the compact display value %s', (username, expected) => {
    expect(getDisplayUsername(username)).toBe(expected);
  });

  it('does not add an at-sign or mutate the source value', () => {
    const original = '@hongyu814__';
    const participant = { number: original };

    expect(getDisplayUsername(participant.number)).toBe('@hongyu81…');
    expect(participant.number).toBe(original);
    expect(getDisplayUsername('hongyu814__')).not.toMatch(/^@@/);
  });

  it('uses distinct full identities even when the displayed labels match', () => {
    const usernames = ['@abcdefgh111', '@abcdefgh222'];

    expect(usernames.map((username) => getDisplayUsername(username))).toEqual(['@abcdefgh…', '@abcdefgh…']);
    expect(new Set(usernames).size).toBe(2);
  });

  it('keeps compact numeric IDs on their established typography and sizes longer identifiers as usernames', () => {
    expect(usesCompactUsernameTypography('007')).toBe(false);
    expect(usesCompactUsernameTypography('1234')).toBe(true);
    expect(usesCompactUsernameTypography('@abc')).toBe(true);
  });
});
