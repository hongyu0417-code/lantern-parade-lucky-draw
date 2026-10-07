# Lantern Parade Lucky Draw

A local browser app for running the Universiti Malaya Lantern Parade lucky draw.

## Run locally

Install Node.js and npm, then from this folder run:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173/`). For a production build, run `npm run build`; its files are written to `dist/`.

## Publish

The `main` branch deploys to GitHub Pages after each push. Enable **Settings → Pages → Build and deployment → Source → GitHub Actions** in the repository if Pages has not been enabled yet.

## Run the draw

1. Open **Settings** before the event. The default pool is the inclusive range **001–300**, with duplicate winners prevented. Set another start/end range or paste participant CSV rows into **Participants CSV**. Each row needs a number and may include a name, for example `001,Amina`; a `NUMBER,NAME` header is optional. Save the pool. Clear the CSV box and save to use the numeric range again.
2. Use **Draw a Lucky Lantern** (or **Space**) to start. Wait for the winner reveal. Use **Next Draw** (or **N**) to return to the draw screen, then repeat.
3. Use **History** to review winners, newest first. The winner and history are saved in this browser's local storage, so a refresh restores the current winner or draw screen. Use the same browser and site address throughout the event.

In **Settings**, **Undo last draw** removes the most recent winner; **Reset draw history** returns all configured numbers to the pool; **Reset all draw data** restores the default settings and clears winners. Both reset actions ask for confirmation. If no eligible numbers remain, change the pool or reset history. The **Prevent duplicate winners** setting controls whether drawn numbers can be selected again.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space | Start a draw from the idle screen |
| N | Continue after a winner |
| A | Open or close operator settings |
| H | Open or close winner history |
| M | Toggle sound |
| F | Enter or exit fullscreen |

Shortcuts do not fire while typing in a field. The settings and history panels are unavailable during the draw animation and while fullscreen is active; exit fullscreen with **F** or the browser's fullscreen control to use them. The on-screen operator toolbar is hidden in fullscreen.
