# Lantern Ascent Survival Draw Implementation Plan

> **For agentic workers:** Use the tasks below in order. Each task uses a test-first cycle and leaves a working app.

**Goal:** Replace the selector animation with a 12-second upward lantern survival race that reveals the winner already saved at draw start.

**Architecture:** Keep draw fairness and persisted records unchanged. Add transient finalist and per-lantern flight plans, advance a 12-second phase timeline, and render the same participant numbers on transform-animated upward paths. The existing stage/backdrop/winner screen remain in place.

**Tech Stack:** React 19, TypeScript, CSS keyframes/transforms, local Web Audio, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-02-flying-number-lanterns-design.md`

## Global Constraints

- Choose and persist the actual winner before animation; animation state cannot change it.
- Show up to 28 unique eligible candidates, bounded to 20–36 for larger pools; show every entry for smaller pools.
- Preselect a distinct visual final three, including the actual winner in a randomized position.
- Make every candidate move upward; non-finalists leave through the top by 7.0 seconds.
- Total animation is exactly 12.0 seconds: 2500, 3000, 1500, 1500, 1200, 1000, 500, 200, and 600 ms.
- Remove every lantern selector, candidate tick, roulette state, and horizontal shuffle.
- Preserve the website, current backdrop, branding, operator UI, participants, winner selection/history, fullscreen, and settled winner screen.
- Honor reduced motion, mute, cleanup, and no external runtime dependencies or media.

---

### Task 1: Choose three visual finalists without changing the winner

**Files:** modify `src/draw/flyingLanterns.ts`; test `tests/draw/flyingLanterns.test.ts`.

**Interface:**

```ts
export function createFinalistLanterns(
  candidates: Participant[],
  winner: Participant,
  randomIndex: (exclusiveMax: number) => number,
): Participant[];
```

It returns three unique roster entries in randomized order when there are at least three entries, always including the saved winner. For one or two entries it returns every unique entry. It rejects a saved winner missing from the roster and invalid injected random indexes.

- [ ] Add a test using candidates `001` through `024` and winner `013`; assert the result has exactly three unique in-roster entries and includes `013`.
- [ ] Add tests for pools of one and two entries, a missing winner, and an invalid random index.
- [ ] Run `npm test -- --run tests/draw/flyingLanterns.test.ts`; confirm the new helper tests fail because the interface is absent.
- [ ] Implement the helper by sampling two distinct non-winners, then insert the saved winner at a random slot.
- [ ] Rerun the focused file; confirm the helper tests pass.

### Task 2: Define distinct curved upward flight plans

**Files:** create `src/draw/lanternFlight.ts`; create `tests/draw/lanternFlight.test.ts`.

**Interface:**

```ts
export type LanternDepth = 'background' | 'midground' | 'foreground';
export type LanternFlightPlan = {
  number: string;
  launchDelayMs: number;
  exitAtMs: number | null;
  flightDurationMs: number;
  depth: LanternDepth;
  launchLeftPercent: number;
  launchTopVh: number;
  curveOneVw: number;
  curveTwoVw: number;
  finalistShiftVw: number;
  finalistRole: 'winner' | 'other' | null;
};
export function createLanternFlightPlans(
  candidates: Participant[],
  finalists: Participant[],
  winner: Participant,
  randomIndex: (exclusiveMax: number) => number,
): LanternFlightPlan[];
```

Use a staggered 0–1200 ms launch delay. Distribute non-finalist exits across 3500–5400 ms for the first 72% and 5500–6900 ms for the remaining entries. Clamp layer-speed adjustments inside those intervals. `flightDurationMs` equals `exitAtMs - launchDelayMs`. Finalists have `exitAtMs: null` and reach their central slots by 7000 ms, then continue a slower upward drift during the 1500 ms finalist phase. Assign depth in a balanced repeating order, starting lanes between 5% and 95%, launch height between 88vh and 108vh, and separate curve values within ±12vw. Place the randomized finalists at 32%, 50%, and 68% by the seven-second mark.

- [ ] Add a test that a 28-candidate fixture returns 28 plans, staggered launch delays, three no-exit finalists, and 25 non-final exit times between 3500 and 6900 ms.
- [ ] Add a test that every non-final duration is positive and ends by 6900 ms, and that background/midground/foreground plans have different durations and curves.
- [ ] Run `npm test -- --run tests/draw/lanternFlight.test.ts`; confirm failure because `lanternFlight.ts` is absent.
- [ ] Implement plan generation with the injected random-index function, saved-winner validation, and validation consistent with `flyingLanterns.ts`.
- [ ] Rerun both focused draw files and confirm candidate/finalist plans are unique and valid.

### Task 3: Change the draw state and phase timeline

**Files:** modify `src/draw/types.ts`, `src/draw/reducer.ts`, `src/hooks/useDrawTimeline.ts`, and `src/App.tsx`; test `tests/draw/reducer.test.ts` and `tests/draw/timeline.test.tsx`.

**Interface:** phases are `idle | awakening | ascending | narrowing | finalists | separating | magnifying | charging | burst | revealing | winner`. `DrawState` carries `animationCandidates` and `animationFinalists`. `RESERVE_DRAW` accepts both transient arrays and validates the saved winner appears in each applicable set. The transition map and timeline use durations 2500, 3000, 1500, 1500, 1200, 1000, 500, 200, and 600 ms.

- [ ] Update reducer tests first: assert the new legal phase order, transient finalists, candidate/finalist cleanup after winner/next draw, and rejection when the winner is absent from finalists.
- [ ] Update timeline tests first with each literal duration and next phase; assert no transition one millisecond early and an exact winner transition at 12,000 ms total.
- [ ] Run both focused files and confirm they fail on the missing phases/fields.
- [ ] Update the phase types, reducer, and timeline map; make `startDraw` reserve and persist the actual winner first, then build candidate/finalist/flight presentation data from the saved winner and pre-draw eligible pool.
- [ ] Preserve direct reduced-motion skip to the saved winner; clear both transient arrays at winner/next draw.
- [ ] Run the two focused files and `npm run typecheck`.

### Task 4: Replace selector visuals with continuous upward flight and finale

**Files:** modify `src/components/FlyingNumberLanterns.tsx`, `src/components/LanternStage.tsx`, `src/styles/stage.css`, `src/components/AudioController.ts`, and `src/App.tsx`; test `tests/components/FlyingNumberLanterns.test.tsx`, `tests/components/LanternStage.test.tsx`, and `src/components/AudioController.test.ts`.

- [ ] Rewrite component tests to assert every participant number is inside its lantern, no selector/tick prop or selector DOM exists, early phases contain the full candidate list, finalists contain exactly the three preselected numbers, losers leave upward during `separating`, and the saved number appears inside the burst and final reveal.
- [ ] Add timer tests that advance through 3500–6900 ms and observe a gradually shrinking roster, exactly three visible candidates at `finalists`, and one winner after the 1200 ms separation phase. Verify scheduled timeouts clear on unmount.
- [ ] Run the focused component files and confirm the selector-era behavior fails the new tests.
- [ ] Render each plan with launch delay, duration, depth, curve offsets, final slot, and role as CSS variables. Start all lanterns at the lower screen, animate upward with distinct transform keyframes, and remove ordinary candidates only when their exit timers complete.
- [ ] Keep three finalists on a slower central upward path; animate the two non-winners off the top while the saved winner eases toward center, then scale/pulse the winner, fragment the lantern, emit the number, and show “LUCKY NUMBER” with “CONGRATULATIONS”.
- [ ] Remove selector ring markup/styles, jump selection timers, tick callback, and selection audio methods. Keep the number warm ivory/gold and readable inside the lantern.
- [ ] Replace selection audio cues with launch/ascent, finalist tension, winner charge, magical whoom/chime, and victory shimmer using local Web Audio only.
- [ ] Run all focused tests, typecheck, and production build; fix any regressions before proceeding.

### Task 5: Verify ten draws, responsive motion, and final scope

**Files:** update `src/App.test.tsx`, `docs/superpowers/specs/2026-10-02-flying-number-lanterns-design.md`, and this plan as needed.

- [ ] Update the 10-draw integration test to advance the 12-second timeline and assert 24–36 initial numbers, unique eligible candidates, winner inclusion in the preselected final three, no extra saved winner on rapid input, exactly three finalists, two upward departures, one focused winner, burst after enlargement, matching number reveal, no duplicates, and reset.
- [ ] Run the integration test ten times in one test execution and then `npm test -- --run`, `npm run typecheck`, `npm run build`, and `git diff --check`.
- [ ] Inspect one full draw in the live browser at desktop and mobile viewport sizes; verify numbers remain readable, every candidate travels upward, only three remain, two leave above, the correct single winner grows and bursts, and no console errors occur.
- [ ] Run one fullscreen sequence and inspect that the transform/opacity animation remains smooth with a 36-lantern roster.
- [ ] Review the final diff to confirm the only app changes concern the animation, phase timing, and animation-linked sound, and that the backdrop and operator workflow remain intact.
