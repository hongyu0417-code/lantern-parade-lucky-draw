# Task 2: Participant pools and winner selection

## Implemented

- Added `Participant` and `WinnerRecord` domain types in `src/draw/types.ts`.
- Added inclusive zero-padded numeric pool generation with validation, CSV participant parsing with optional headers and quoted fields, and deterministic winner selection with duplicate prevention in `src/draw/pool.ts`.
- Added 15 focused tests covering ranges, invalid inputs, CSV formats/errors/duplicates, winner selection, and random-index validation in `tests/draw/pool.test.ts`.

## Test-first evidence

Before implementation, `npm test -- tests/draw/pool.test.ts` failed during module resolution because `src/draw/pool.ts` did not exist. After implementation, the first focused run exposed a parser edge case: a malformed single-cell row under a two-column header was accepted. The parser was updated to enforce the header's column count, and the focused suite then passed.

## Verification

- `npm test -- tests/draw/pool.test.ts`: passed, 15 tests.
- `npm test -- --run`: passed, 2 files and 16 tests.
- `npm run typecheck`: passed.
- `npm run build`: passed.

## Concerns

CSV parsing reports unmatched quotes as field content rather than a dedicated syntax error; malformed row shape and missing participant numbers are reported with source row numbers. No additional issues were observed in the requested verification.
