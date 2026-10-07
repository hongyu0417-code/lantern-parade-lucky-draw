/** Returns a compact presentation label without changing the participant identity. */
export function getDisplayUsername(username: string, maxCharacters = 10): string {
  const characters = Array.from(username);
  if (!Number.isInteger(maxCharacters) || maxCharacters < 2) {
    throw new Error('The display limit must be an integer of at least two characters.');
  }
  if (characters.length <= maxCharacters) return username;
  return `${characters.slice(0, maxCharacters - 1).join('')}…`;
}

/** Short numeric draw IDs keep their established type treatment; other values use username sizing. */
export function usesCompactUsernameTypography(identifier: string): boolean {
  return !/^\d{1,3}$/.test(identifier);
}
