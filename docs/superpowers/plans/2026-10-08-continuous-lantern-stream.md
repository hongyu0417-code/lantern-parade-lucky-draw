# Continuous Lantern Stream and Audio Sync Implementation Plan

> **For agentic workers:** Execute inline, one task at a time, with the tests and checkpoints below.

**Goal:** Preserve the existing lucky-draw design while creating a continuous, frame-rate-independent lantern stream and synchronizing audio to its actual motion events.

**Architecture:** Keep a fixed 28-element DOM pool and move its mutable lantern models in one shared `requestAnimationFrame` loop. A density-aware scheduler recycles each same model only after it exits above the viewport; Space disables scheduling while the remaining models continue their paths. Motion milestones advance the existing 3 → 2 → 1 state sequence and trigger its audio cues. The existing synthesized Web Audio cues remain asset-free and are warmed after the user gesture.

**Tech Stack:** React, TypeScript, Web Animations/CSS for paper effects, one delta-time animation frame loop, Web Audio API, Vitest, Testing Library, Vite.

**Spec:** User brief at `/Users/hongyu814/.codex/attachments/f0f3d3a4-1051-49a7-ada2-61ed7ba5cac6/Pasted text.txt`.

## Global Constraints

- Preserve the current page composition, backdrop, Chinese interface, compact Instagram usernames, winner screen, 3 → 2 → 1 choreography, manual Space stop, duplicate prevention, settings, and history.
- Render the idle kicker exactly as `第二十六届马大灯笼节 · 灯笼游行` above `幸运抽奖`.
- Cap the pool at 28 stable DOM objects; choose an active target between 18 and 28 from viewport area.
- Spawn only while preparing/running, at randomized intervals bounded to 120–450ms; initialize every carrier below the viewport.
- Clamp each animation-frame delta to 33ms; animate coordinates with `translate3d`, scale, rotation, and opacity, without frame-by-frame React state.
- Keep existing visible carriers moving when Space stops refill; preserve winner selection from the complete eligible pool and the existing reveal.
- Trigger separation and burst audio from the corresponding motion/animation start; guard each cue against duplicate playback within a draw.
- Run the requested 1920×1080, two-minute stream check and isolated Space/audio acceptance draws without mutating production participant data.

---

### Task 1: Lock in current requirements and trace the motion/audio lifecycle

**Files:**
- Test: `tests/components/LanternStage.test.tsx`
- Test: `tests/draw/lanternMotion.test.ts` (new)
- Test: `src/components/AudioController.test.ts`
- Test: `tests/components/FlyingNumberLanterns.test.tsx`

- [ ] Add tests that assert the exact rendered kicker, bounded viewport targets and spawn intervals, delta clamping, smooth velocity interpolation, stable carrier keys through recycle, no refill after Space, and one cue per motion event.
- [ ] Run the focused tests and record their expected failures before implementation.
- [ ] Update tests whose assertions still refer to the obsolete pre-manual-stop phases and props; retain coverage for full-pool winner selection, duplicate protection, and the current 3 → 2 → 1 flow.

### Task 2: Replace per-carrier animation restarts with a pooled RAF motion engine

**Files:**
- Create: `src/draw/lanternMotion.ts`
- Modify: `src/components/FlyingNumberLanterns.tsx`
- Modify: `src/draw/flyingLanterns.ts`
- Modify: `src/draw/lanternFlight.ts`
- Modify: `src/components/LanternStage.tsx`
- Modify: `src/styles/stage.css`

- [ ] Model a fixed 28-slot pool with stable IDs, shared rightward wind, constrained launch variation, viewport-scaled target density, and active-only will-change.
- [ ] Advance all active positions in one RAF loop using clamped delta time, sinusoidal sway, smoothed velocity/scale targets, and direct DOM transform writes.
- [ ] Recycle the same slot after its lantern exits the top; assign its next eligible username and new constrained motion parameters while it is invisible, then relaunch from below.
- [ ] Schedule individual entries with bounded jitter and density feedback. Start the first entry after 180–350ms and ramp into overlapping continuous motion without a one-time batch.
- [ ] Stop scheduling synchronously on Space; let non-finalists exit on their current paths, gently slow the selected existing carriers, and dispatch 3 → 2 → 1 milestones only when each exit actually completes.
- [ ] Interpolate the solo winner’s upward speed, center position, and scale with the same frame loop. Keep the existing paper burst/reveal visuals and simplify only effects that profiling shows are expensive.
- [ ] Cancel the RAF, resize/visibility listeners, and any motion callbacks on unmount.

### Task 3: Tie audio to draw and motion events; fix public copy

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AudioController.ts`
- Modify: `src/components/LanternStage.tsx`
- Modify: `src/components/FlyingNumberLanterns.tsx`
- Test: `src/App.test.tsx`
- Test: `src/components/AudioController.test.ts`

- [ ] Replace the intro kicker with the exact event title and assert that exact visible text.
- [ ] Initialize/warm Web Audio on the start gesture; start one quiet ambience for RUNNING, raise tension at Final 3 and Final 2, and fade it out at reveal.
- [ ] Add a subtle Space cue, exit whooshes on the first frame of each losing-carrier exit, charge cue on winner enlargement, burst cue on the same frame the visual burst begins, and victory cue at reveal onset.
- [ ] Reset per-draw event guards at the next draw, prevent cue stacking, stop ambient nodes on finish/mute/unmount, and retain synthesized cues without loading audio assets.
- [ ] Run focused tests to green, then `npm test -- --run`, `npm run typecheck`, and `npm run build`.
- [ ] Open a local isolated browser session at 1920×1080, verify the exact public heading, run the continuous stream for two minutes, inspect pool size/frame behavior, and perform ten local draws checking Space, exit, charge, burst, reveal, and audio sync.
- [ ] Publish the verified feature branch through the existing GitHub/Vercel connection and confirm the production URL responds successfully.
