# Flying Number Lanterns Design

## Goal and scope

Replace only the in-progress lucky draw animation with a suspenseful sequence of visible, moving participant-number lanterns. Preserve the existing page layout, backdrop, branding, controls outside the draw, operator tools, participant pool, history, fullscreen behavior, and winner-selection rules.

## Fairness and candidate roster

`reserveDraw` continues to choose and persist the actual winner synchronously before animation. From that draw's eligible pre-reservation pool, a pure helper makes a transient roster of up to 28 distinct real participant numbers (clamped to 20–36 when at least 20 people are eligible). The actual winner must always be present. For pools under 20, show every unique eligible number once rather than inventing numbers. Roster and animation state are not written to storage and cannot affect the winner.

## Eleven-second sequence

The phases, in order, are awakening (1.5s), rushing (2.5s), selector (2s), finalists (2s), winner lock (1s), charge (0.7s), burst (0.6s), and reveal (0.7s), then the existing winner screen. This totals 11 seconds. Each transition clears its previous timer. Reduced-motion mode goes directly to the already-persisted winner.

- Awakening staggers the numbered lanterns up from the lake.
- Rush sends them across the scene in varied directions, speed, scale, and depth.
- Selector moves a visible gold ring across candidates, ticking quickly before slowing, with one or two longer near-miss pauses.
- Finalists retains the predetermined winner and two other unique roster entries, or all available entries if fewer than three exist. The visible lanterns orbit near center while the ring ticks more slowly.
- Lock places the ring on the predetermined winner, holds, then flies the other two lanterns toward opposite sides.
- Charge brings the winner lantern forward with a stronger reflection and glow.
- Burst opens the lantern into a festival-style ring, warm fragments, and sparks, while the number emerges and scales forward.
- Reveal shows a large readable number and congratulations briefly before handing off to the existing winner screen.

## Visual and runtime constraints

Every roster item remains an actual participant number visibly set inside its lantern. Selector and finalist numbers are especially clear. Use CSS transforms and opacity for motion, a small fixed particle count, and the existing local art. Keep the current controls hidden during the sequence. Do not add runtime network requests, heavy 3D, external audio, or unrelated UI changes. Existing optional Web Audio is extended only for quiet selector/lock/burst cues. All timers and audio scheduling must clean up on phase changes and unmount.

## Verification

Unit tests verify roster uniqueness, pool membership, winner inclusion, target size, and small-pool behavior. Reducer and timeline tests verify the exact phase order and reduced-motion skip. Stage and app integration tests verify visible numbered lanterns, three finalists, loser-flyaway and burst states, the predetermined reveal, rapid-input locking, reset, and ten consecutive duplicate-free draws. Complete the requested ten-draw test and inspect one full live sequence in the open browser while preserving the current page outside the draw.
