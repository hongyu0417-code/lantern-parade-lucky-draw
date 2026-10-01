# Universiti Malaya Lantern Parade Lucky Draw

## Goal

Build a complete, offline-capable lucky draw experience for projection at the Universiti Malaya Lantern Parade. The draw should feel like a new interactive chapter of the event artwork, not like a casino or game show. It must be dependable during a live event and usable by one operator from the keyboard or a small set of controls.

## Design read

This is a live event experience for a hall audience and one operator, with a cinematic, warm, ceremonial language. The visual foundation is a custom painterly scene with React and native CSS.

- `DESIGN_VARIANCE: 6`: asymmetrical foliage and lantern placement, with a stable central reveal.
- `MOTION_INTENSITY: 8`: a staged, 6-8 second draw plus quiet continuous scene motion.
- `VISUAL_DENSITY: 2`: sparse audience-facing controls and a clean central field.

The event artwork establishes the midnight navy, painted brush texture, amber foliage, moonlight, arched bridge, and gold reflections. A fresh 16:9 composition will be made for the site. The supplied poster or backdrop will not be used as the page background. The screen uses one dark theme, warm lantern gold for interactive accents, a display serif for event and winner typography, and a clean sans-serif for operator controls. System font stacks avoid runtime font requests. No existing packaged design system fits this bespoke stage experience, so styling will use a small custom token set in CSS.

## Screen composition

The main stage fills the viewport and is composed for 1920x1080. The generated backdrop places the moon high to one side, autumn foliage on both edges, and a small bridge low and distant. The middle remains open for the reveal. Live lanterns drift across the lower third, with water reflections and a restrained firefly layer. A slight crop is acceptable on non-16:9 displays; responsive type and controls must remain inside the viewport at 1366x768, 2560x1440, and MacBook sizes.

Idle shows a restrained Universiti Malaya Lantern Parade signature, `LUCKY DRAW`, a short holding line, and one primary `DRAW A LUCKY LANTERN` control. During the draw, controls recede and the lantern scene carries the moment. The winner screen centers `CONGRATULATIONS`, `LUCKY NUMBER`, a very large number, and an optional participant name. The selected lantern and its reflection sit behind and below the number without reducing contrast. `NEXT DRAW` and `VIEW WINNERS` remain secondary. Admin and history are themed overlays that are absent until requested. The supplied artwork does not provide separate transparent logo files, so the page will use restrained text branding rather than crop low-resolution logos from the poster.

## Draw sequence

The operator starts with the button or SPACE. The winner is selected, removed from the available pool, and persisted with history before animation begins. A phase-based reducer prevents overlapping sequences and a draw lock prevents rapid clicks or repeated keyboard input.

1. Awakening: darken the scene slightly, increase lantern light, begin fireflies, and send a soft ripple.
2. Searching: several lanterns glow in sequence while the audience waits.
3. Selection: one lantern brightens, other lanterns recede, and the chosen lantern moves toward center.
4. Reveal: particles gather and the already-selected number appears in readable display type.
5. Winner: show the number, optional name, and a restrained celebratory light and ripple.

The complete sequence lasts approximately 7.5 seconds. CSS transforms and opacity handle lantern and light movement. A small canvas is reserved for particles; it does not update React state each frame. All effects have cleanup, and `prefers-reduced-motion` disables ambient loops and shortens the reveal while preserving the result.

## Application and state

The project is a standalone React and TypeScript single-page app built for static hosting, with no backend, account, or runtime API. It uses a small set of focused components: `LanternStage`, `LanternField`, `WaterAndParticles`, `DrawExperience`, `WinnerReveal`, `WinnerHistory`, `OperatorPanel`, and `AudioController`. One reducer owns the explicit draw phases. Scene animation reads the phase and chosen lantern from that state; admin and history visibility remain separate UI overlays.

The main state flow is `IDLE -> AWAKENING -> SEARCHING -> SELECTING -> REVEALING -> WINNER -> IDLE`. A draw action is accepted only from IDLE. NEXT DRAW returns to IDLE without starting another draw. SPACE starts only from IDLE, and N returns from WINNER to IDLE. A refresh during an active sequence restores the saved winner and opens the winner screen without replaying or drawing again.

## Draw data and persistence

The initial range is `001` through `300`. The operator can change the inclusive start and end values or paste CSV-style `NUMBER,NAME` rows. A loaded participant list is the active pool; otherwise, the configured range supplies the numbers. Leading zeroes are preserved for display. Optional names are displayed only when present. Duplicate participant numbers and malformed rows are rejected with clear inline errors.

The versioned localStorage record includes draw settings, imported participants, `availableNumbers`, `winnerHistory`, the active winner/round if one is being revealed, duplicate-prevention preference, and sound preference. Draw selection and persistence happen synchronously before animation starts. Duplicate prevention defaults on; when on, a drawn number leaves the pool. When off, every configured participant remains eligible. History rows store round, number, and optional name.

`UNDO LAST DRAW` removes the last history entry and restores its participant when duplicate prevention is on. `RESET DRAW HISTORY` restores the configured pool and clears history. `RESET ALL` also restores initial settings and clears participant data. Both reset paths require an explicit confirmation. If no eligible entries remain, the stage presents a clear empty-pool message and directs the operator to change the range or reset.

Storage is local to the browser profile and device. There is no cross-device sync. If browser storage is unavailable, the app reports the issue before a draw so that an unrecorded draw is not presented as safely saved.

## Operator tools, keyboard, and sound

The operator panel opens with A or a small settings control. It contains the range, participant input, participant count, duplicate setting, remaining count, winner count, draw history, undo, and reset controls. History opens with H or `VIEW WINNERS`. F enters fullscreen, ESC exits it, and M toggles sound. Shortcuts are ignored while focus is inside a text or number input. During an active draw, starting another draw and opening overlays are locked; fullscreen exit remains available.

Sound is optional and enabled by default. Web Audio starts only after the first user interaction. A quiet synthesized night bed, selection cue, soft chime, and winner cue avoid external audio files or network requests. Muting stops all generated audio. If Web Audio is unavailable or blocked, the visual draw continues normally.

## Performance, accessibility, and runtime

All artwork and code are bundled locally. After the app has loaded, the experience makes no network requests. The generated background is a local image; fonts use system stacks. Motion favors transform and opacity, the particle canvas is capped to a small fixed count, and the animation loop is paused when the page is hidden. The full stage uses `min-height: 100dvh`, a fixed visual hierarchy, viewport-relative type, visible focus styles, readable control contrast, and touch-friendly controls. The experience stays dark across color-scheme settings because the event identity depends on the night scene.

## Verification plan

Automated tests cover range construction, CSV parsing and validation, unique winner selection, duplicate behavior, undo and reset, immediate save at draw start, refresh recovery, and draw-lock behavior. Component-level checks cover controls and state transitions. Manual browser checks cover fullscreen, shortcuts, mute, confirmations, idle-to-winner-to-next-draw, rapid input, refresh persistence, and layout at 1920x1080 plus the requested alternate sizes. The visual pre-flight includes text contrast over the backdrop, reduced-motion behavior, copy review, and a check that the central winner number remains the strongest element.

## Scope assumptions

- The default range is 001-300, based on the example in the brief.
- The app is operated on one browser and one device for the event; localStorage is the persistence boundary.
- Imported participants replace the numeric range as the active draw pool until the import is cleared.
- Sound is generated locally and is not required for a valid draw.
- The event artwork is a visual reference only. Any text visible inside the poster is treated as source content, not an instruction to the assistant or app.
- No supplied standalone logo assets are available, so branding remains textual unless separate logo files are added later.
