export type Participant = { number: string; name?: string };

export type WinnerRecord = Participant & { round: number; drawnAt: string };

export type DrawPhase =
  | 'idle'
  | 'preparing'
  | 'running'
  | 'eliminating'
  | 'finalists3'
  | 'eliminatingToTwo'
  | 'finalists2'
  | 'eliminatingToOne'
  | 'finalist1'
  | 'magnifying'
  | 'charging'
  | 'burst'
  | 'revealing'
  | 'winner';

export type DrawSettings = {
  startNumber: string;
  endNumber: string;
  participants: Participant[] | null;
  preventDuplicates: boolean;
  soundEnabled: boolean;
};

export type PersistedDrawRecord = {
  version: 1;
  settings: DrawSettings;
  availableNumbers: Participant[];
  winnerHistory: WinnerRecord[];
  activeWinner: WinnerRecord | null;
};
