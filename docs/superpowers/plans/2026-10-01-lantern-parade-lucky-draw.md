# Lucky Lantern Draw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Each task includes test-first steps and a commit.

**Goal:** Build a stable, offline-capable Universiti Malaya Lantern Parade lucky draw for a 16:9 event screen.

**Architecture:** A standalone React/TypeScript single-page app will use a versioned localStorage draw record and a phase reducer. A new painterly background image will be generated from the supplied artwork references; CSS and a small Canvas layer will animate lanterns, reflections, and fireflies. Static hosting is sufficient, with no runtime API or backend.

**Tech Stack:** React, TypeScript, Vite, Motion (`motion/react`) for state transitions, native CSS for scene movement, Canvas for particles, Web Audio for optional sound, Vitest and Testing Library for verification.

**Spec:** `docs/superpowers/specs/2026-10-01-lantern-parade-lucky-draw-design.md`

## Global Constraints

- Design for 1920x1080 first, with responsive support for 1366x768, 2560x1440, and MacBook screens.
- Default draw range is `001` through `300`; imported `NUMBER,NAME` CSV becomes the active pool.
- Persist the selected winner and history before any animation begins.
- No duplicate winners by default; the explicit operator toggle may allow repeats.
- Use localStorage; do not add a backend, login, or runtime API.
- Keep all visual assets and fonts local after the page loads.
- The generated scene must be new artwork, with no text, logos, or static lanterns baked into the image.
- Respect `prefers-reduced-motion`, maintain accessible contrast and focus, and prevent overlapping draws.

---

## File Map

- `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`: Vite, TypeScript, test, and page entry configuration.
- `src/main.tsx`, `src/App.tsx`: React mount and top-level experience wiring.
- `src/draw/types.ts`: participant, winner, settings, persisted record, and stage-phase types.
- `src/draw/pool.ts`: range generation, CSV parsing, and uniform eligible-winner selection.
- `src/draw/persistence.ts`: record defaults, storage validation, reserve/undo/reset operations, and localStorage access.
- `src/draw/reducer.ts`: transient stage phases and overlay state transitions.
- `src/hooks/useDrawTimeline.ts`: phase timers with cleanup and reduced-motion handling.
- `src/hooks/useFullscreen.ts`: fullscreen enter/exit and state synchronization.
- `src/components/LanternStage.tsx`: scene composition and phase-aware experience layout.
- `src/components/LanternField.tsx`: independently drifting lantern elements and chosen-lantern motion.
- `src/components/FirefliesCanvas.tsx`: low-count particle canvas with pause/cleanup behavior.
- `src/components/WinnerReveal.tsx`: large accessible winning number, congratulations, optional name, and next actions.
- `src/components/OperatorPanel.tsx`: range, participant import, duplicate setting, history counts, undo, and reset.
- `src/components/WinnerHistory.tsx`: themed, readable winner list and empty state.
- `src/components/AudioController.ts`: lazy Web Audio initialization, cues, ambient loop, and mute.
- `src/styles/tokens.css`, `src/styles/stage.css`, `src/styles/panels.css`: one dark theme, stage layout, responsive rules, reduced motion, and UI states.
- `public/lantern-lake-stage.png`: generated 16:9 painterly environment without text or lanterns.
- `tests/draw/pool.test.ts`, `tests/draw/persistence.test.ts`, `tests/draw/reducer.test.ts`: raffle and state behavior.
- `tests/components/WinnerReveal.test.tsx`, `tests/components/OperatorPanel.test.tsx`, `tests/components/keyboard.test.tsx`: user-visible behavior.

---

## Task 1: Scaffold the standalone React and test environment

**Files:** create the project manifest, Vite and TypeScript configs, page shell, and `src/main.tsx`/`src/App.tsx`.

**Interfaces:** The app mounts `<App />` from `#root`. CSS is imported once by `src/main.tsx`. Vite serves the same entry used by the static production build.

- [ ] Create package scripts `dev`, `build`, `typecheck`, and `test`. Add React, React DOM, Vite, the React Vite plugin, TypeScript, Motion, Phosphor icons, Vitest, jsdom, and Testing Library dependencies. Confirm installed packages in `package.json` before importing them.
- [ ] Configure Vitest with jsdom and Testing Library setup. Add a minimal `App` render test and run it before adding application behavior.
- [ ] Create `index.html` with the document title, viewport metadata, and `#root`. Do not add remote font or script links.
- [ ] Add the minimal React mount, app heading, and test setup. The smoke test must fail before `App` exists, then pass after the mount is implemented.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build`. Commit the scaffold.

Expected smoke test:

```tsx
it("renders the Lantern Parade draw screen", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: /lucky draw/i })).toBeInTheDocument();
});
```

## Task 2: Implement and test participant pools and winner selection

**Files:** create `src/draw/types.ts`, `src/draw/pool.ts`, and `tests/draw/pool.test.ts`.

**Interfaces:**

```ts
export type Participant = { number: string; name?: string };
export type WinnerRecord = Participant & { round: number; drawnAt: string };
export function buildNumericPool(start: string, end: string): Participant[];
export function parseParticipantsCsv(input: string): { participants: Participant[]; errors: string[] };
export function selectWinner(
  eligible: Participant[],
  preventDuplicates: boolean,
  randomIndex: (exclusiveMax: number) => number,
): { winner: Participant; availableNumbers: Participant[] };
```

- [ ] Write tests for inclusive zero-padded range generation, invalid and reversed ranges, CSV with or without a header, quoted commas in names, blank rows, malformed rows, and duplicate participant numbers.
- [ ] Run `npm test -- tests/draw/pool.test.ts` and confirm it fails because the pool module does not exist.
- [ ] Implement the three exported functions. Validate `randomIndex` output and throw a clear error for an empty eligible pool.
- [ ] Test that duplicate prevention removes the selected participant and that repeat-enabled mode leaves the pool unchanged. Use an injected deterministic index in tests.
- [ ] Re-run the focused test and full suite, then commit.

## Task 3: Add persisted draw records and phase transitions

**Files:** create `src/draw/persistence.ts`, `src/draw/reducer.ts`, `src/hooks/useDrawTimeline.ts`, and tests for persistence and reducer behavior.

**Interfaces:**

```ts
export type DrawPhase = "idle" | "awakening" | "searching" | "selecting" | "revealing" | "winner";
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
export function createDefaultRecord(): PersistedDrawRecord;
export function reserveDraw(
  record: PersistedDrawRecord,
  randomIndex: (exclusiveMax: number) => number,
  drawnAt: string,
): PersistedDrawRecord;
export function undoLastDraw(record: PersistedDrawRecord): PersistedDrawRecord;
export function resetDrawHistory(record: PersistedDrawRecord): PersistedDrawRecord;
export function readDrawRecord(storage: Storage): PersistedDrawRecord;
export function writeDrawRecord(storage: Storage, record: PersistedDrawRecord): void;
```

- [ ] Test the default range and persistence version. Test that `reserveDraw` immediately adds history, stores `activeWinner`, and removes the number when duplicate prevention is on.
- [ ] Test repeat-enabled selection, empty-pool failure, undo restoration, reset rebuilding from the active source, storage round-trip, corrupt records, and storage write failure.
- [ ] Run the new tests and confirm they fail before implementation.
- [ ] Implement record validation and pure state operations. If a range or participant list changes, rebuild the active pool while preserving history and excluding previous winners when duplicate prevention is enabled.
- [ ] Add reducer actions for reserving a draw, advancing phases, returning to idle, opening/closing overlays, and toggling sound. Rehydrate an `activeWinner` directly into the winner phase after a refresh.
- [ ] Test reducer draw locking, phase ordering, refresh recovery, and that draw start cannot reserve twice. Re-run all tests and commit.

Phase timing is 1100ms awakening, 2200ms searching, 1400ms selection, 1400ms reveal, and 1400ms winner settle. The timeline hook advances phases through reducer actions and clears every timeout on phase change or unmount. Under reduced motion, it presents the saved winner immediately.

## Task 4: Generate the backdrop and build the animated stage

**Files:** create `public/lantern-lake-stage.png`, `src/components/LanternStage.tsx`, `src/components/LanternField.tsx`, `src/components/FirefliesCanvas.tsx`, `src/styles/tokens.css`, and `src/styles/stage.css`.

**Interfaces:** `LanternStage` receives `phase`, `activeWinner`, `onDraw`, `onNext`, `onHistory`, and `reducedMotion`. `LanternField` receives `phase` and `chosenNumber`. `FirefliesCanvas` receives `intensity` and `paused`.

- [ ] Generate a new wide painterly moonlit lake scene from the three provided artworks as visual references. The asset has foliage framing both sides, a high moon, a low distant bridge, open center water, and no text, logos, or lanterns. Save the generated result locally as `public/lantern-lake-stage.png`.
- [ ] Write a visual stage test for the initial `LUCKY DRAW` heading and the single primary draw action, then run it to confirm it fails.
- [ ] Implement the idle, drawing, and winner presentation using the generated local background. Build the lanterns as restrained CSS scene elements so they can drift and move to center.
- [ ] Animate only transform and opacity for lantern movement. Add slow, low-contrast water reflections and a reduced-motion static fallback.
- [ ] Implement a capped firefly canvas loop that pauses when hidden or reduced motion is requested and cleans up its animation frame on unmount.
- [ ] Test the generated image path and stage content. Run all tests, typecheck, and production build, then commit.

## Task 5: Build winner history and the operator panel

**Files:** create `src/components/WinnerReveal.tsx`, `src/components/WinnerHistory.tsx`, `src/components/OperatorPanel.tsx`, and `src/styles/panels.css`.

**Interfaces:** `WinnerReveal` receives the winner and `onNext`/`onHistory` callbacks. `WinnerHistory` receives `winnerHistory` and `onClose`. `OperatorPanel` receives settings, remaining count, winner count, validation status, and typed callbacks for save, undo, reset history, reset all, and close.

- [ ] Test the winner number and optional name, the aria-live announcement, the history list, and the empty history state. Confirm tests fail before creating the components.
- [ ] Implement the large winner display and quiet secondary actions. Preserve number formatting and keep the central number legible over the selected lantern.
- [ ] Test labels, import validation errors, remaining/winner counts, confirmation dialogs, undo/reset callbacks, and disabled controls during active phases.
- [ ] Implement the operator panel with labels above number fields, CSV textarea, duplicate toggle, counts, and confirmed reset actions. Keep admin and history absent from the audience state until opened.
- [ ] Re-run focused component tests, typecheck, and build, then commit.

## Task 6: Add keyboard, fullscreen, sound, and application wiring

**Files:** modify `src/App.tsx` and add stage control/notice props in `src/components/LanternStage.tsx`; create `src/hooks/useFullscreen.ts` and `src/components/AudioController.ts`; add keyboard and fullscreen tests.

**Interfaces:** `useFullscreen()` returns `{ isFullscreen, enterFullscreen, exitFullscreen }`. `AudioController` exposes `initialize`, `playSearchingCue`, `playWinnerCue`, `setMuted`, and `dispose`.

- [ ] Test shortcuts with a focused input and without one. Confirm SPACE starts only from idle, N returns to idle from winner, A/H toggle panels, M toggles sound, and F requests fullscreen.
- [ ] Implement keyboard handling with cleanup. Ignore shortcuts when focus is in editable fields and ignore draw starts while the draw is locked.
- [ ] Test fullscreen state synchronization and implement enter/exit with the Fullscreen API. Leave ESC handling to browser fullscreen behavior while syncing the stage on `fullscreenchange`.
- [ ] Add visible, accessible controls for settings, sound, and fullscreen outside presentation mode. Hide the operator controls in fullscreen and show inline storage and empty-pool guidance on the stage.
- [ ] Implement low-volume Web Audio tones only after the first user interaction. Test mute state and no-throw fallback when Web Audio is unavailable.
- [ ] Wire record save before reducer phase start. On storage failure, show an inline error and do not begin a draw.
- [ ] Test idle -> draw -> winner -> next draw -> second draw with distinct winners and persisted history. Test refresh recovery and rapid clicks.
- [ ] Run the full suite, typecheck, and production build, then commit.

## Task 7: Final live-event reliability and visual verification

**Files:** adjust only the above implementation and tests; add `README.md` with run and operator instructions.

- [ ] Run the complete automated suite and production build. Fix failures before visual review.
- [ ] Start the app and verify 1920x1080, 1366x768, 2560x1440, and a MacBook viewport. Confirm the winner number occupies roughly 20-30% of screen height without clipping.
- [ ] Manually run two draws, verify distinct winners, refresh while idle and after a draw, undo, reset confirmation, CSV names, empty pool, and storage failure messaging.
- [ ] Verify SPACE, N, F, A, H, M, text-field shortcut suppression, fullscreen exit, muted and enabled sound, and rapid click locking.
- [ ] Inspect the app with reduced motion enabled. Check focus visibility, readable controls over the generated art, no unintended network requests, and no console errors.
- [ ] Perform the design-taste pre-flight: re-read all visible copy, check one dark theme and gold interactive accent, confirm CTA labels remain on one line, and check that motion communicates scene changes.
- [ ] Write concise local run instructions, verify `git status`, and commit the completed build.
