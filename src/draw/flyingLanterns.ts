import type { Participant } from './types';

export const MIN_FLYING_LANTERNS = 20;
export const MAX_FLYING_LANTERNS = 36;
export const DEFAULT_FLYING_LANTERNS = 28;

function checkedIndex(randomIndex: (exclusiveMax: number) => number, exclusiveMax: number): number {
  const index = randomIndex(exclusiveMax);
  if (!Number.isInteger(index) || index < 0 || index >= exclusiveMax) {
    throw new Error(`Random index must be an integer between 0 and ${exclusiveMax - 1}.`);
  }
  return index;
}

function shuffle<T>(items: T[], randomIndex: (exclusiveMax: number) => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = checkedIndex(randomIndex, index + 1);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function uniqueParticipants(participants: Participant[]): Participant[] {
  return [...new Map(participants.map((participant) => [participant.number, participant])).values()];
}

/** Creates the first bounded field of distinct moving lanterns. */
export function createInitialLanternRoster(
  eligible: Participant[],
  randomIndex: (exclusiveMax: number) => number,
  targetCount = DEFAULT_FLYING_LANTERNS,
): Participant[] {
  const unique = uniqueParticipants(eligible);
  const requested = Number.isFinite(targetCount) ? Math.floor(targetCount) : DEFAULT_FLYING_LANTERNS;
  const boundedTarget = Math.min(MAX_FLYING_LANTERNS, Math.max(MIN_FLYING_LANTERNS, requested));
  return shuffle([...unique], randomIndex).slice(0, Math.min(unique.length, boundedTarget));
}

/** Chooses the next stream label without duplicating a currently visible participant when possible. */
export function chooseNextLanternParticipant(
  eligible: Participant[],
  activeNumbers: Set<string>,
  randomIndex: (exclusiveMax: number) => number,
): Participant | null {
  const unique = uniqueParticipants(eligible);
  if (unique.length === 0) return null;
  const available = unique.filter(({ number }) => !activeNumbers.has(number));
  const choices = available.length > 0 ? available : unique;
  return choices[checkedIndex(randomIndex, choices.length)];
}

/** Selects a temporary, visible roster without changing the already-reserved winner. */
export function createCandidateLanterns(
  eligible: Participant[],
  winner: Participant,
  randomIndex: (exclusiveMax: number) => number,
  targetCount = DEFAULT_FLYING_LANTERNS,
): Participant[] {
  const unique = [...new Map(eligible.map((participant) => [participant.number, participant])).values()];
  const winningEntry = unique.find(({ number }) => number === winner.number);
  if (!winningEntry) throw new Error('The saved winner must be in the eligible pool.');

  const requested = Number.isFinite(targetCount) ? Math.floor(targetCount) : DEFAULT_FLYING_LANTERNS;
  const boundedTarget = Math.min(MAX_FLYING_LANTERNS, Math.max(MIN_FLYING_LANTERNS, requested));
  const rosterSize = Math.min(unique.length, boundedTarget);
  const otherEntries = shuffle(unique.filter(({ number }) => number !== winningEntry.number), randomIndex);
  const roster = otherEntries.slice(0, rosterSize - 1);
  const winnerSlot = checkedIndex(randomIndex, roster.length + 1);
  roster.splice(winnerSlot, 0, winningEntry);
  return roster;
}

/** Chooses the transient final trio without changing the saved winner. */
export function createFinalistLanterns(
  candidates: Participant[],
  winner: Participant,
  randomIndex: (exclusiveMax: number) => number,
): Participant[] {
  const unique = [...new Map(candidates.map((participant) => [participant.number, participant])).values()];
  const winningEntry = unique.find(({ number }) => number === winner.number);
  if (!winningEntry) throw new Error('The saved winner must be in the finalist roster.');
  if (unique.length <= 3) return shuffle(unique, randomIndex);

  const otherFinalists = shuffle(unique.filter(({ number }) => number !== winner.number), randomIndex).slice(0, 2);
  const winnerSlot = checkedIndex(randomIndex, otherFinalists.length + 1);
  otherFinalists.splice(winnerSlot, 0, winningEntry);
  return otherFinalists;
}
