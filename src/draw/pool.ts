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

function parseCsvRows(input: string): { rows: { cells: string[]; line: number }[]; errors: string[] } {
  const rows: string[][] = [];
  const rowLines: number[] = [];
  const errors: string[] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;
  let invalidRow = false;
  let line = 1;
  let rowStartLine = 1;
  let quoteStartLine = 1;

  const finishRow = () => {
    row.push(field.trim());
    if (invalidRow) {
      errors.push(`Row ${rowStartLine}: malformed quote syntax.`);
    } else {
      rows.push(row);
      rowLines.push(rowStartLine);
    }
    row = [];
    field = '';
    afterQuote = false;
    invalidRow = false;
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        field += char;
        if (char === '\n') line += 1;
        else if (char === '\r' && input[index + 1] !== '\n') line += 1;
      }
    } else if (char === '"') {
      if (!afterQuote && field.trim() === '') {
        quoted = true;
        quoteStartLine = line;
      } else {
        invalidRow = true;
        field += char;
      }
    } else if (afterQuote && char !== ',' && char !== '\n' && char !== '\r' && !/\s/.test(char)) {
      invalidRow = true;
      field += char;
      afterQuote = false;
    } else if (char === ',' ) {
      row.push(field.trim());
      field = '';
      afterQuote = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      finishRow();
      line += 1;
      rowStartLine = line;
    } else {
      field += char;
    }
  }
  if (quoted) {
    errors.push(`Row ${rowStartLine}: unclosed quote starting on row ${quoteStartLine}.`);
  } else if (row.length > 0 || field.length > 0 || input.length === 0 || !/[\r\n]$/.test(input)) {
    finishRow();
  }
  return {
    rows: rows.map((cells, index) => ({ cells, line: rowLines[index] })),
    errors,
  };
}

export function parseParticipantsCsv(input: string): { participants: Participant[]; errors: string[] } {
  const parsed = parseCsvRows(input);
  const meaningfulRows = parsed.rows
    .filter(({ cells }) => cells.some((cell) => cell.length > 0));
  const participants: Participant[] = [];
  const errors: string[] = [...parsed.errors];
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
