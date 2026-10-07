# Smart Username Display Implementation Plan

> **For agentic workers:** Execute this plan inline, one task at a time, with the TDD cycle shown below.

**Goal:** Keep full participant identifiers for draw logic while showing compact labels in moving lanterns and fitting the full winner username after the burst.

**Architecture:** Add one presentation-only username formatter. Use it only for lantern labels; keep `Participant.number` as the unmodified identity in the pool, draw, keys, animation lookup, history, and exports. Render the full winner in the post-burst reveal and size username typography from its code-point count.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, CSS.

**Spec:** `/Users/hongyu814/.codex/attachments/39515dfe-4761-4c6c-ad83-11eebb8a7944/Pasted text.txt`

## Global Constraints

- Preserve the existing website design, Chinese interface, animations, and random draw mechanism.
- Truncation is visual only; preserve complete original participant values.
- Use a single Unicode ellipsis (`…`) and keep lantern labels on one line.
- Keep the complete winner username visible only after the winning lantern bursts.

---

### Task 1: Username display formatter and imported identities

**Files:**
- Create: `src/draw/usernames.ts`
- Create: `tests/draw/usernames.test.ts`
- Modify: `src/draw/pool.ts`
- Test: `tests/draw/pool.test.ts`

**Interfaces:**
- Produce `getDisplayUsername(username: string, maxCharacters?: number): string`, preserving values up to 10 Unicode code points and replacing longer values with the first 9 code points plus `…`.
- Import parsing accepts username-oriented headers and keeps source values unchanged.

- [x] Write behavior tests for unchanged short usernames, truncated medium/long/31-character usernames, missing `@`, and distinct full usernames that share a display label.
- [x] Run the focused tests and confirm the new formatter is missing and username headers are not recognized.
- [x] Implement the formatter and extend username header recognition without altering source identifiers.
- [x] Run formatter and pool tests; confirm duplicate checks and winner selection still use complete values.

### Task 2: Compact lantern labels and post-burst reveal

**Files:**
- Modify: `src/components/FlyingNumberLanterns.tsx`
- Modify: `src/styles/stage.css`
- Test: `tests/components/FlyingNumberLanterns.test.tsx`

**Interfaces:**
- Visible lamp text uses `getDisplayUsername`; keys, `data-number`, `data-flight-number`, and selection continue using full values.
- No full username appears in the burst phase; the existing revealing phase shows the full value after the burst.

- [x] Add component tests for short/medium/long lantern labels, three finalists, colliding shortened labels, and full-value reveal timing.
- [x] Run the focused tests and confirm they fail against the current rendering.
- [x] Apply the formatter only to visible lamp text; constrain username sizing on desktop and mobile while preserving the existing typography for short numeric IDs.
- [x] Move the full emergence status into the post-burst revealing phase; keep burst effects unchanged.
- [x] Run the focused tests and inspect all full-value identity attributes.

### Task 3: Full-size winner text and existing full-value surfaces

**Files:**
- Modify: `src/components/WinnerReveal.tsx`
- Modify: `src/components/OperatorPanel.tsx`
- Modify: `src/styles/stage.css`
- Test: `tests/components/WinnerReveal.test.tsx`
- Test: `tests/components/OperatorPanel.test.tsx`
- Test: `tests/draw/persistence.test.ts`

**Interfaces:**
- Winner reveal and history keep complete identifiers. Username typography uses the complete string length to fit within a single-line safe width.
- Import hints identify usernames while preserving the existing form layout and numeric range option.

- [x] Add tests asserting exact long winner and history values, storage round trips, and username import with and without `@`.
- [x] Run the focused tests and confirm required username behavior is missing.
- [x] Add a responsive width-based font-size rule for usernames and longer identifiers; retain the complete text.
- [x] Update only participant-import example/help copy; keep export values unchanged.
- [x] Run the focused tests and verify the complete imported and revealed strings.

### Task 4: Full verification and publish

**Files:** No additional product files.

- [x] Run the full test suite, type check, production build, and whitespace check.
- [x] Review the final diff to confirm it contains only this username-display feature and its implementation plan.
- [x] Fix the mobile font-size override, scale username labels to lantern width so long labels fit, retain the ellipsis, and confirm short numeric labels keep their previous font treatment.
- [ ] Commit the completed changes and push `main` so the connected Vercel deployment updates.
- [ ] Confirm the Vercel URL serves the published update.
