# Streaks — a tiny habit tracker

A mobile-first habit tracker that runs entirely in the browser. No build step, no
dependencies, no backend: habits and history are stored in `localStorage` on the
device that uses it.

## What it does

- **Today** — one tap per habit to check it off, with a progress ring and a 7-day
  strip so you can back-fill a day you forgot.
- **Week** — a grid of every habit × every day; tap any square to toggle it.
  Navigate back through previous weeks.
- **Progress** — 30-day consistency, best current streak, total check-ins, and a
  per-habit bar. Export / import a JSON backup, or erase everything.
- Per-habit emoji, colour, and a weekly target (1–7 days). Daily habits count a
  day streak; habits with a target below 7 count a streak of weeks that hit the
  target.
- Installable PWA (manifest + service worker) — "Add to Home Screen" gives it an
  icon and it works offline.
- Light/dark follows the device, safe-area aware, 44px tap targets.

## Run it locally

Any static server works. For example:

```bash
npx serve habit-tracker
```

Opening `index.html` directly from disk also works — the service worker just
stays disabled on `file://`.

## Host it

It is a static site: upload the contents of this folder as-is.

- **Netlify / Vercel** — drag the folder into the dashboard, no build command,
  publish directory = this folder.
- **GitHub Pages** — push the folder to a repo and enable Pages on that branch.
- **Cloudflare Pages** — connect the repo, leave the build command empty.

All paths are relative, so it works from a subdirectory (e.g.
`user.github.io/habit-tracker/`) as well as from a domain root. Serve it over
HTTPS so the service worker and install prompt are available.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup and app shell |
| `styles.css` | All styling, theming tokens, layout |
| `app.js` | State, storage, streak maths, rendering |
| `sw.js` | Offline cache — bump `CACHE` after changing assets |
| `manifest.webmanifest` | PWA metadata |
| `icon.svg`, `icon-*.png` | App icons |

## Data

Stored under the `habitTracker.v1` key:

```json
{
  "version": 1,
  "habits": [
    { "id": "h…", "name": "Read 10 pages", "emoji": "📖",
      "color": "#4f7cff", "goal": 7, "createdAt": "2026-08-28" }
  ],
  "done": { "h…": { "2026-08-28": 1 } }
}
```

Clearing browser data for the site deletes it, and it does not sync between
devices — use **Export backup** on the Progress tab to move it.
