# Manual-Stop Lantern Draw Design

## Goal and scope

Change only the active draw lifecycle. Preserve the existing website design, Chinese interface, artwork, compact Instagram labels, winner screen, magical burst, sound controls, fullscreen, history, duplicate prevention, and admin settings. The public screen must not explain the hidden Space control. The public Start button begins the draw; Space only stops a running draw.

## One data-to-animation constraint

The current app animates at most 36 distinct participant lanterns at a time, while the eligible pool can contain up to 10,000 entries. A winner chosen from the full pool at stop time therefore may not be one of the usernames currently attached to a visible lantern. Three requirements cannot all hold without a policy choice: select from the full eligible pool at Space, keep each displayed username attached to the same lantern identity, and never introduce or replace any lantern after Space.

### Options considered

1. **Full-pool selection at Space, retain three existing lantern carriers (recommended).** Use secure randomness against the complete eligible pool when Space is pressed. Select two distinct losing finalists from that same pool. During the natural narrowing, transition the selected identities onto three already-moving lantern carriers without unmounting or respawning those physical lanterns. This preserves draw fairness, the requested selection moment, and physical animation continuity; the visible username labels can change during the narrowing transition.
2. **Select only from current visible usernames.** The three finalists remain attached to the exact same identities throughout. This makes the visual continuity literal, but people outside the current field are excluded from that draw and their odds depend on when Space is pressed.
3. **Preselect secretly from the full pool at Start and commit at Space.** This preserves full-pool odds and stable identities, but the winner is fixed before the organizer stops the draw, contrary to the requested stop-time selection.

Unless the user requests another tradeoff, implementation follows option 1.

## Draw state and winner selection

Use explicit states: `idle → running → eliminating → finalists3 → finalists2 → finalist1 → magnifying → charging → burst → revealing → winner`.

- Start enters `running`, starts a continuous upward stream with a bounded number of concurrently mounted lantern objects, and does not reserve or persist a winner.
- Lantern objects that leave above the viewport are recycled into the stream only while `running`. Active usernames come from the eligible participant snapshot; the stream avoids showing the same full identity twice at once when the pool allows it.
- On Space in `running`, stop creating or recycling objects, choose a winner from the complete current eligible pool using the existing unbiased Web Crypto sampler, and choose up to two distinct non-winning finalists. Reserve and persist the winner at this point, preserving duplicate-prevention rules. If persistence fails, remain `running`, show the existing save error, and allow a retry.
- Space in every other state is ignored. Remove the current idle Space-to-start shortcut. Do not add a visible public instruction or a required admin stop button.
- The selected finalist identities are transitioned onto three already-mounted, moving lantern objects as the field narrows. The object keys and flight continuity survive this content update; do not clear the field and remount finalists.
- For pools of two or fewer eligible entries, keep the existing small-pool behavior: show all available people and omit unavailable elimination steps rather than inventing participants.

## Manual stop and suspense timing

| Stage | Target duration | Behavior |
| --- | ---: | --- |
| Running | Operator-controlled | Lanterns continue rising and recycling indefinitely. No timer selects a winner or starts elimination. |
| Elimination | About 2.5s | Stop recycling immediately. Existing objects keep rising and leave through the top naturally until the three selected identities remain. |
| Final 3 | 1.5s | Three lanterns float gently with equal size, brightness, and styling. |
| 3 → 2 | About 0.8s | One losing lantern continues upward faster and exits through the top, without a sudden fade or lateral departure. |
| Final 2 | 1.2s | Two equally styled lanterns continue floating. |
| 2 → 1 | About 0.8s | The second losing lantern rises out through the top. |
| Final 1 | 0.65s | The remaining winner continues a subtle float before slowing. |
| Magnifying | About 1.2s | Ease upward velocity toward zero, move gradually to center, enlarge from its natural scale to about 1.9×, and intensify its inner glow. Keep the label truncated. |
| Charging | 0.55s | Build the glow and soft halo with a restrained pulse, slight vibration, and a few golden sparks. |
| Burst / reveal | Existing burst, about 0.8s total | Reuse the existing paper fragments, fireflies, and circular shockwave. Reveal the complete Instagram username at burst onset, then hand off to the existing winner screen. |

The 3 → 2 → 1 pauses are mandatory. Do not focus, center, enlarge, brighten, border, or otherwise distinguish the actual winner until the solo lantern stage. Losing finalists leave by continuing upward, with no side movement or abrupt fade.

## Motion, sound, and accessibility

Use persistent lantern objects and compositor-friendly transforms. Stop timers and animations cleanly on unmount or phase change. Keep the current optional sound system and use its relevant cues for start, elimination, finalist holds, charge, and burst. No new sound controls or visual treatment are required.

Respect reduced-motion preferences without skipping the manual stop or any of the 3 → 2 → 1 suspense states. Reduce or remove movement while preserving the operator-controlled sequence and its holds. Do not automatically reveal a winner because reduced motion is enabled.

## Persistence and recovery

Winner history and available-pool changes occur when Space selects and successfully persists the winner, not when Start begins the visual stream. A failed write must not partially reserve a winner or begin elimination. After a page reload during `running`, return to idle with no recorded draw. Once a winner is persisted, preserve the existing active-winner recovery behavior.

## Review checklist

- Only the draw control and animation flow changes; no layout or artwork redesign.
- Space starts nothing in idle, stops only in running, and is harmless in every later phase.
- There is no automatic stop, including with reduced motion enabled.
- The draw selects from all eligible people at stop time and keeps duplicate prevention intact.
- Lanterns stop recycling on Space, current objects keep moving, and three finalist identities are carried on existing objects.
- The audience sees a held 3, one natural upward exit, a held 2, a second natural upward exit, and a held 1 before winner emphasis.
- The complete username appears with the existing burst, and all unrelated site features remain available as before.
