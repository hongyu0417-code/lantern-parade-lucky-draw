export type Participant = { number: string; name?: string };

export type WinnerRecord = Participant & { round: number; drawnAt: string };
