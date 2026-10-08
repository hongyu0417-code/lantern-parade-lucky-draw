# Manual-Stop Lantern Draw Implementation Plan

> **For agentic workers:** Execute this plan inline, one task at a time, with the checkpoints below.

**Goal:** Replace the automatic lucky-draw stop with an operator-controlled Space stop, preserving full-pool odds and a smooth 3 → 2 → 1 winner finale.

**Architecture:** The reducer owns the manual draw phases and winner persistence. The lantern layer owns a bounded set of stable moving carriers, recycles them only while running, and transfers the three selected identities onto existing carriers when stopping. Phase timers pace the natural exits and finale; reduced motion never skips the operator stop or finalist holds.

**Tech Stack:** React 19, TypeScript, CSS, Web Animations API, Web Crypto, Vite.

**Spec:** `docs/superpowers/specs/2026-10-08-manual-stop-draw-design.md`

## Global Constraints

- Preserve the existing layout, Chinese UI, artwork, usernames, winner screen, history, settings, fullscreen, sound, and duplicate-prevention behavior.
- Start begins a continuous upward lantern field; there is no automatic stop.
- Space acts only during `running`; idle Space does not trigger a draw.
- Select and persist the real winner from the complete eligible pool only when Space is pressed.
- Stop lantern recycling immediately on Space; preserve moving lantern DOM objects and do not respawn finalists.
- Hold the final 3 for 1.5s, the final 2 for 1.2s, and the final 1 for 0.65s; losers leave upward in separate 0.8s stages.
- Reveal the complete username with the existing burst; do not show a winner cue before the solo stage.
- Reduced motion must retain manual control and every finalist state.

---

### Task 1: Manual state machine and stop-time winner persistence

**Files:**
- Modify: `src/draw/types.ts`
- Modify: `src/draw/reducer.ts`
- Modify: `src/draw/flyingLanterns.ts`
- Modify: `src/hooks/useDrawTimeline.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- `DrawPhase` gains `running`, `eliminating`, `finalists3`, `eliminatingToTwo`, `finalists2`, `eliminatingToOne`, and `finalist1`; `preparing`, `magnifying`, `charging`, `burst`, `revealing`, and `winner` remain as applicable.
- `START_DRAW` stores a snapshot of the currently eligible participants and enters the existing 320ms preparation transition without reserving a winner.
- `BEGIN_ELIMINATION` accepts the persisted winner record and the complete selected finalist list, validates they came from the run pool, and enters `eliminating` only from `running`.
- `createFinalistLanterns(eligible, winner, randomIndex)` continues to return the winner plus up to two distinct randomly ordered losing finalists.
- `useDrawTimeline(phase, finalistCount, dispatch)` advances timed suspense phases only; `running` has no timer.

- [x] Replace the automatic phases in `DrawPhase` and reducer with the manual-stop sequence. Keep overlay, settings, persistence, recovery, and return-to-idle rules intact.
- [x] Update phase timing to 320ms preparation, 2.5s elimination, 1.5s final 3, 0.8s first loser exit, 1.2s final 2, 0.8s second loser exit, 0.65s final 1, 1.2s magnifying, 0.55s charging, 0.2s burst, and 0.6s revealing.
- [x] Change `startDraw` to begin the run and snapshot eligible participants without calling `reserveDraw` or writing winner history.
- [x] Add one `stopDraw` callback guarded by `phase === 'running'` and a ref against same-render double presses. On Space, use `createSecureRandomIndex`, `reserveDraw`, and `createFinalistLanterns` against the complete eligible pool; persist before dispatching elimination.
- [x] Leave the run active and show the existing save error if persistence fails; clear the stop guard so the operator can retry.
- [x] Remove the idle Space-to-start shortcut. Handle Space only in `running`; keep normal focused-button and editable-field keyboard behavior intact.
- [x] Keep reduced-motion preference out of draw progression so it cannot skip the manual stop or finalist stages.

### Task 2: Continuous field using persistent lantern carriers

**Files:**
- Modify: `src/components/FlyingNumberLanterns.tsx`
- Modify: `src/draw/lanternFlight.ts`
- Modify: `src/draw/flyingLanterns.ts`

**Interfaces:**
- `FlyingNumberLanterns` receives `phase`, `eligible`, `finalists`, nullable `winner`, and `reducedMotion`.
- Each rendered carrier has a stable internal `instanceId` key independent of `Participant.number`.
- One natural flight completion callback removes an exiting carrier and creates its replacement only while phase is `preparing` or `running`.
- The stop transition maps finalist participants onto three mounted carrier IDs and annotates those carriers with a neutral finalist slot.

- [x] Replace the one-time candidate roster with 20–28 initial carrier objects sampled uniquely from the eligible snapshot; use all participants for smaller pools.
- [x] Give each carrier a one-pass upward flight with staggered launch and 4.5–7.5s duration. On natural top exit, refill from an eligible identity not currently visible where possible.
- [x] Keep each carrier animation in a keyed child component so adding a new carrier does not restart existing Web Animations.
- [x] On entry to `eliminating`, stop refills, select three visible existing carriers, and smoothly transition the selected finalist labels into those carriers. Continue every non-survivor’s current upward path into a staggered upward exit completed within 2.5s.
- [x] Keep all finalists visually equal through `finalists3` and `finalists2`; do not add winner role, winner glow, center position, size, or border before `finalist1`.
- [x] Ensure pools of one or two carry only their available identities and skip impossible finalist counts without inventing entries.
- [x] Clear each carrier animation, exit callback, and replacement timer when it exits or the component unmounts.

### Task 3: Paced 3 → 2 → 1 choreography and stage wiring

**Files:**
- Modify: `src/components/LanternStage.tsx`
- Modify: `src/components/FlyingNumberLanterns.tsx`
- Modify: `src/styles/stage.css`
- Modify: `src/App.tsx`

**Interfaces:**
- `LanternStage` passes the run pool and stop-selected finalists to the lantern layer; it displays no stop instructions and adds no visible control.
- `eliminatingToTwo` and `eliminatingToOne` choose the next non-winner in the pre-randomized finalist order.
- The component emits only the full winner reveal at burst onset; the existing settled winner screen continues to receive the complete identity.

- [x] Wire `LanternStage` to render the same lantern layer from preparation through reveal, passing the run pool before stop and the stored winner/finalists after stop.
- [x] At `finalists3`, hold three equal lanterns; at `eliminatingToTwo`, send one loser out through the top over 0.8s; at `finalists2`, hold two equal lanterns; at `eliminatingToOne`, send the other loser out through the top over 0.8s.
- [x] At `finalist1`, hold the solo winner for 0.65s. Only then glide it to center and scale it gradually to about 1.9× over 1.2s, then charge for 0.55s.
- [x] Reuse the existing lantern burst effects and show the full username at burst onset; continue into the existing winner screen without changing history or next-draw controls.
- [x] Update only phase selectors and motion styles needed by these phases. Preserve colors, typography, art, layout, and all existing non-draw surface styles.
- [x] Reduce movement/effect intensity for reduced-motion users without shortening, skipping, or auto-completing the manual sequence.
- [x] Keep existing audio cues mapped to launch, ascent, elimination/finalists, magnification, charge, and burst; do not add new audio controls.

### Task 4: Integration review and production build

**Files:** No additional product files.

- [x] Review the implementation against every item in the approved spec and the Global Constraints.
- [x] Run `npm run typecheck` and `npm run build`; resolve any compilation errors.
- [x] Review the final branch diff; it should contain only the approved draw-flow implementation, design spec, and plan.
- [x] Publish through the existing GitHub and Vercel path under the user's prior explicit publishing request.
