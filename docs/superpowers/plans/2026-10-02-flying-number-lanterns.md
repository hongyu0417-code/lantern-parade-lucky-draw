# Flying Number Lanterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the passive lucky-draw animation with an 11-second sequence of moving, numbered lanterns that always ends on the winner already saved at draw start.

**Architecture:** Add a pure candidate-roster helper based on the pre-reservation eligible pool. Extend the reducer and timeline to explicit phases, then render those phases in a dedicated flying-number-lantern component inside the current stage. Keep persistence and the existing final winner page as-is.

**Tech Stack:** Existing React 19, TypeScript, CSS transforms/keyframes, Web Audio, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-02-flying-number-lanterns-design.md`

## Global Constraints

- The persisted winner is selected before the animation and cannot be changed by it.
- Roster entries must be unique numbers from the eligible pool and include the saved winner.
- Use up to 28 candidates, clamped to 20–36 for pools of 20 or more; show all unique participants for smaller pools.
- Total phase duration is 11 seconds, followed by the existing winner screen.
- Keep the current artwork, layout, identity, draw controls, operator tools, and history unchanged outside the running draw.
- Keep reduced-motion behavior, optional local audio, timer cleanup, and transform/opacity-based movement.

---

### Task 1: Create and test the real-number candidate roster

**Files:** create `src/draw/flyingLanterns.ts`; test `tests/draw/flyingLanterns.test.ts`.

**Interface:** `createCandidateLanterns(eligible: Participant[], winner: Participant, randomIndex: (exclusiveMax: number) => number, targetCount = 28): Participant[]`.

- [ ] Write tests that fail when the winner is omitted, an ineligible number is introduced, a number repeats, a roster exceeds 36, or a pool under 20 is padded with invented entries.
- [ ] Run the focused test and confirm it fails because the helper is absent.
- [ ] Implement deduplication, injected-random sampling, winner inclusion, size clamping, and random-index validation.
- [ ] Run the focused test and confirm all roster behaviors pass.

### Task 2: Extend transient draw state and timeline

**Files:** modify `src/draw/types.ts`, `src/draw/reducer.ts`, `src/hooks/useDrawTimeline.ts`, `src/App.tsx`; test `tests/draw/reducer.test.ts`, `tests/draw/timeline.test.tsx`.

**Interface:** phases are `idle | awakening | searching | selecting | finalists | locking | charging | burst | revealing | winner`; `DrawState` holds a transient `animationCandidates: Participant[]`; `RESERVE_DRAW` accepts both persisted `record` and transient candidates.

- [ ] Add failing behavior tests for ordered phase advancement, clearing candidates at next draw, rejecting out-of-order advances, and reduced-motion direct reveal.
- [ ] Implement the phase map and durations: 1500, 2500, 2000, 2000, 1000, 700, 600, 700 milliseconds.
- [ ] In `startDraw`, snapshot eligible participants, reserve the winner, create its candidate roster, save the record, then dispatch the saved record and roster together. Leave the persisted schema unchanged.
- [ ] Run focused tests and ensure candidate roster and phase behavior pass.

### Task 3: Build the flying lantern animation

**Files:** create `src/components/FlyingNumberLanterns.tsx`; modify `src/components/LanternStage.tsx`, `src/styles/stage.css`, `src/components/AudioController.ts`, `src/App.tsx`; test `tests/components/FlyingNumberLanterns.test.tsx`.

**Interface:** component receives `phase`, `candidates`, `winner`, and a tick callback. The existing stage renders it only while a draw is active; the idle field and settled winner screen remain in place.

- [ ] Add failing component tests for in-lantern readable numbers, roster size, selector ring, exactly three finalists (or all entries under three), loser flight classes, burst fragments, and the winner number emerging.
- [ ] Implement staggered awakening, crossing depth-layer rush, slowing selector ticks with two near-miss pauses, finalist orbit, opposite loser exits, winner charge, shockwave/fragments, and short reveal.
- [ ] Add quiet local tick, lock, charge, burst, and victory cues using the existing optional audio controller, with cleanup and mute respected.
- [ ] Hide existing operator controls while animation runs, keep the event masthead and backdrop, and keep all moving content readable at selector/finalist stages.
- [ ] Run component tests, typecheck, and build.

### Task 4: Verify ten consecutive draws and inspect the live sequence

**Files:** modify `src/App.test.tsx` and existing test helpers only as needed.

- [ ] Add an integration test over ten consecutive draws from a 40-person pool. For every run assert 20–36 unique visible eligible candidates, saved-winner inclusion, rapid-input draw locking, three finalists, loser departure, burst, final saved winner, and a clean next-draw reset.
- [ ] Run the focused integration test and full test suite; fix any state or timer leaks it exposes.
- [ ] Run typecheck and production build.
- [ ] Watch one complete draw in the open local browser, checking number legibility and stage transitions on the existing art; verify the winner screen and next-draw reset.
- [ ] Review the final diff to confirm the changes stay within the draw animation and its tests/docs.
