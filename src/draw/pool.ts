import type { Participant } from './types';

export function buildNumericPool(start: string, end: string): Participant[] {
  const validInteger = /^\d+$/;
  if (!validInteger.test(start) || !validInteger.test(end)) {
    throw new Error('Start and end must be non-negative whole numbers.');
  }

  const first = Number(start);
  const last = Number(end);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) {
    throw new Error('Start and end must be safe integers.');
  }
  if (last < first) throw new Error('End must be greater than or equal to start.');

  const width = Math.max(start.length, end.length);
  const participants: Participant[] = [];
  for (let value = first; value <= last; value += 1) {
    participants.push({ number: String(value).padStart(width, '0') });
  }
  return participants;
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  rows.push(row);
  return rows;
}

export function parseParticipantsCsv(input: string): { participants: Participant[]; errors: string[] } {
  const parsedRows = parseCsvRows(input);
  const meaningfulRows = parsedRows
    .map((cells, index) => ({ cells, line: index + 1 }))
    .filter(({ cells }) => cells.some((cell) => cell.length > 0));
  const participants: Participant[] = [];
  const errors: string[] = [];
  if (meaningfulRows.length === 0) return { participants, errors };

  const firstCells = meaningfulRows[0].cells.map((cell) => cell.toLowerCase());
  const hasHeader = firstCells[0] === 'number' || firstCells[0] === 'id';
  const expectedColumns = hasHeader ? meaningfulRows[0].cells.length : undefined;
  const dataRows = hasHeader ? meaningfulRows.slice(1) : meaningfulRows;
  const seen = new Set<string>();

  for (const { cells, line } of dataRows) {
    if (cells.length < 1 || cells.length > 2 || !cells[0] || (expectedColumns !== undefined && cells.length !== expectedColumns)) {
      errors.push(`Row ${line}: expected a participant number and optional name.`);
      continue;
    }
    const number = cells[0];
    if (seen.has(number)) {
      errors.push(`Row ${line}: duplicate participant number "${number}".`);
      continue;
    }
    seen.add(number);
    participants.push(cells[1] ? { number, name: cells[1] } : { number });
  }
  return { participants, errors };
}

export function selectWinner(
  eligible: Participant[],
  preventDuplicates: boolean,
  randomIndex: (exclusiveMax: number) => number,
): { winner: Participant; availableNumbers: Participant[] } {
  if (eligible.length === 0) throw new Error('Cannot select a winner from an empty eligible pool.');

  const index = randomIndex(eligible.length);
  if (!Number.isInteger(index) || index < 0 || index >= eligible.length) {
    throw new Error(`Random index must be an integer between 0 and ${eligible.length - 1}.`);
  }
  const winner = eligible[index];
  const availableNumbers = preventDuplicates
    ? eligible.filter((_, candidateIndex) => candidateIndex !== index)
    : eligible;
  return { winner, availableNumbers };
}
