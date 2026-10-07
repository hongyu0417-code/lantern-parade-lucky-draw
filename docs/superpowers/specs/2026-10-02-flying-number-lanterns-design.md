# Lantern Ascent Survival Draw Design

## Goal and scope

Replace only the active lucky-draw animation with a continuous upward lantern race. Keep the current website, moonlit backdrop, event branding, layout, admin tools, participant import, random winner logic, winner history, fullscreen behavior, and settled winner screen. The animation must contain no selector, pointer, hopping highlight, roulette tick, card shuffle, or equivalent winner-picking visual.

## Fair selection and finalist set

`reserveDraw` continues selecting and persisting the actual winner before animation begins. A transient roster contains up to 28 unique eligible participant numbers (bounded to 20–36 when the eligible pool is large; all unique entries when it is smaller). A separate visual-only helper selects exactly three distinct roster entries when at least three exist, including the saved winner in a randomized position. Smaller pools keep every available entry. Neither transient set changes storage or winner odds.

## Twelve-second ascent sequence

| Elapsed | Phase | Duration | Motion |
| --- | --- | ---: | --- |
| 0.0–2.5s | `awakening` | 2.5s | 24–36 numbered lanterns launch from staggered lower-screen positions. |
| 2.5–5.5s | `ascending` | 3.0s | All continue on distinct curved upward paths; depth, size, sway, and speed vary. Candidates drift past the top edge at different times. |
| 5.5–7.0s | `narrowing` | 1.5s | The final non-finalists continue upward and fade only after reaching the upper edge. Exactly three remain at the transition. |
| 7.0–8.5s | `finalists` | 1.5s | The three continue a slower, gentle ascent near the middle, with subtle independent drift. |
| 8.5–9.7s | `separating` | 1.2s | The two non-winners continue upward toward the top and leave frame. The saved winner slows and drifts toward center. |
| 9.7–10.7s | `magnifying` | 1.0s | Only the winner remains, slowly enlarging from its lantern scale toward 190%, with a growing inner glow. |
| 10.7–11.2s | `charging` | 0.5s | Hold the centered winner for a gradual golden pulse, tiny sparks, and a soft vibration. |
| 11.2–11.4s | `burst` | 0.2s | A festival-like paper/frame fragment burst and circular light wave release the winning number. |
| 11.4–12.0s | `revealing` | 0.6s | The large “LUCKY NUMBER” emergence settles with drifting gold motes and “CONGRATULATIONS”, then hands off to the existing winner screen. |

The timeline totals 12 seconds. All flight paths move upward throughout the mass, narrowing, and finalist stages. Paths use compositor-friendly transforms and opacity, with staggered delay, bounded horizontal curves, rotation, and depth. Ordinary candidates fade out only at the end of their upward path. The winner and two finalists are fixed before flight begins, so the saved winner cannot be eliminated. The existing winner selection remains the sole source of truth.

## Number treatment and sound

Each lantern shows its real participant number, centered inside the warm luminous paper, in warm ivory-gold with a dark warm outline for contrast. The three finalists receive no special border or glow until the winner begins its final solo ascent. The winner emphasis is gradual; no effect hops between candidates.

Keep the existing optional local Web Audio and mute control. Replace selection and tick cues with a gentle rising launch tone, quiet wind-like ascent cue, increasing soft tension tone, a low cinematic pulse for the finalists, a short rising charge, a warm whoom-and-chime burst, and a brief victory shimmer. Do not add external audio or casino-like sounds. Mute must stop all active voices, and audio must remain optional when Web Audio is unavailable.

## Lifecycle and accessibility

All candidate removal timers and sound voices clean up on unmount. Phase timers clear on transition and unmount. Reduced-motion preference skips directly to the already-persisted winner. The existing controls stay hidden during the draw and return on the settled winner screen. Keep useful live-region announcements without displaying candidate counts or “Top 3” copy.

## Verification

Unit tests cover unique eligible rosters, winner inclusion, exactly three random visual finalists for large pools, small-pool behavior, staggered distinct curved flight plans, and exits no later than the final-three boundary. Reducer/timeline tests cover the new phase order and exact 12-second total. Component tests cover readable in-lantern numbers, upward-path styles, naturally decreasing candidate counts, exactly three survivors, upward exits for two finalists, gradual winner focus, burst, and number emergence with no selector or tick callback. The app integration test completes ten consecutive duplicate-free draws and verifies the predetermined saved winner reaches the final screen each time. Manually inspect one full sequence at desktop and mobile sizes, with a fullscreen run to check motion smoothness and no runtime errors.
