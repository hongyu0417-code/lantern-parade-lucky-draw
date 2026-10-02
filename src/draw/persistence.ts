import { buildNumericPool, MAX_PARTICIPANTS, selectWinner } from './pool';
import type { DrawSettings, Participant, PersistedDrawRecord, WinnerRecord } from './types';

export const DRAW_STORAGE_KEY = 'lantern-parade-draw-v1';

const DEFAULT_SETTINGS: DrawSettings = {
  startNumber: '001',
  endNumber: '300',
  participants: null,
  preventDuplicates: true,
  soundEnabled: true,
};

function activeSource(settings: DrawSettings): Participant[] {
  if (settings.participants && settings.participants.length > MAX_PARTICIPANTS) {
    throw new Error('A draw pool cannot exceed 10,000 participants.');
  }
  return settings.participants ?? buildNumericPool(settings.startNumber, settings.endNumber);
}

function eligibleSource(settings: DrawSettings, history: WinnerRecord[]): Participant[] {
  const source = activeSource(settings);
  if (!settings.preventDuplicates) return source;
  const drawnNumbers = new Set(history.map(({ number }) => number));
  return source.filter(({ number }) => !drawnNumbers.has(number));
}

export function createDefaultRecord(): PersistedDrawRecord {
  const settings = { ...DEFAULT_SETTINGS };
  return {
    version: 1,
    settings,
    availableNumbers: activeSource(settings),
    winnerHistory: [],
    activeWinner: null,
  };
}

export function reserveDraw(
  record: PersistedDrawRecord,
  randomIndex: (exclusiveMax: number) => number,
  drawnAt: string,
): PersistedDrawRecord {
  const { winner, availableNumbers } = selectWinner(record.availableNumbers, record.settings.preventDuplicates, randomIndex);
  const winnerRecord: WinnerRecord = {
    ...winner,
    round: record.winnerHistory.length + 1,
    drawnAt,
  };
  return {
    ...record,
    availableNumbers,
    winnerHistory: [...record.winnerHistory, winnerRecord],
    activeWinner: winnerRecord,
  };
}

export function updateDrawSettings(
  record: PersistedDrawRecord,
  changes: Partial<DrawSettings>,
): PersistedDrawRecord {
  const settings = { ...record.settings, ...changes };
  const sourceChanged = settings.startNumber !== record.settings.startNumber
    || settings.endNumber !== record.settings.endNumber
    || settings.participants !== record.settings.participants;
  const eligibilityChanged = settings.preventDuplicates !== record.settings.preventDuplicates;

  return {
    ...record,
    settings,
    availableNumbers: sourceChanged || eligibilityChanged
      ? eligibleSource(settings, record.winnerHistory)
      : record.availableNumbers,
  };
}

export function undoLastDraw(record: PersistedDrawRecord): PersistedDrawRecord {
  if (record.winnerHistory.length === 0) return record;
  const winnerHistory = record.winnerHistory.slice(0, -1);
  return {
    ...record,
    winnerHistory,
    activeWinner: null,
    availableNumbers: eligibleSource(record.settings, winnerHistory),
  };
}

export function resetDrawHistory(record: PersistedDrawRecord): PersistedDrawRecord {
  return {
    ...record,
    availableNumbers: activeSource(record.settings),
    winnerHistory: [],
    activeWinner: null,
  };
}

export function resetAllDrawData(): PersistedDrawRecord {
  return createDefaultRecord();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isParticipant(value: unknown): value is Participant {
  if (!isObject(value) || typeof value.number !== 'string' || value.number.trim() === '') return false;
  return value.name === undefined || typeof value.name === 'string';
}

function isWinner(value: unknown): value is WinnerRecord {
  if (!isObject(value) || !isParticipant(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Number.isInteger(candidate.round)
    && (candidate.round as number) > 0
    && typeof candidate.drawnAt === 'string';
}

function isSettings(value: unknown): value is DrawSettings {
  if (!isObject(value)) return false;
  const participants = value.participants;
  const start = typeof value.startNumber === 'string' && /^\d+$/.test(value.startNumber)
    ? Number(value.startNumber)
    : NaN;
  const end = typeof value.endNumber === 'string' && /^\d+$/.test(value.endNumber)
    ? Number(value.endNumber)
    : NaN;
  const validParticipants = participants === null
    || (Array.isArray(participants)
      && participants.length <= MAX_PARTICIPANTS
      && participants.every(isParticipant)
      && new Set(participants.map((participant) => participant.number)).size === participants.length);
  return Number.isSafeInteger(start)
    && Number.isSafeInteger(end)
    && end >= start
    && end - start < MAX_PARTICIPANTS
    && validParticipants
    && typeof value.preventDuplicates === 'boolean'
    && typeof value.soundEnabled === 'boolean';
}

function isPersistedRecord(value: unknown): value is PersistedDrawRecord {
  if (!isObject(value)
    || value.version !== 1
    || !isSettings(value.settings)
    || !Array.isArray(value.availableNumbers)
    || value.availableNumbers.length > MAX_PARTICIPANTS
    || !value.availableNumbers.every(isParticipant)
    || new Set(value.availableNumbers.map((participant) => participant.number)).size !== value.availableNumbers.length
    || !Array.isArray(value.winnerHistory)
    || !value.winnerHistory.every(isWinner)
    || value.winnerHistory.some((winner, index) => winner.round !== index + 1)
    || (value.activeWinner !== null && !isWinner(value.activeWinner))) return false;

  const activeWinner = value.activeWinner;
  const lastWinner = value.winnerHistory.at(-1);
  return activeWinner === null || (lastWinner !== undefined
    && activeWinner.number === lastWinner.number
    && activeWinner.name === lastWinner.name
    && activeWinner.round === lastWinner.round
    && activeWinner.drawnAt === lastWinner.drawnAt);
}

export function readDrawRecord(storage: Storage): PersistedDrawRecord {
  try {
    const serialized = storage.getItem(DRAW_STORAGE_KEY);
    if (!serialized) return createDefaultRecord();
    const parsed: unknown = JSON.parse(serialized);
    if (!isPersistedRecord(parsed)) return createDefaultRecord();
    return {
      ...parsed,
      availableNumbers: eligibleSource(parsed.settings, parsed.winnerHistory),
    };
  } catch {
    return createDefaultRecord();
  }
}

export function writeDrawRecord(storage: Storage, record: PersistedDrawRecord): void {
  storage.setItem(DRAW_STORAGE_KEY, JSON.stringify(record));
}
