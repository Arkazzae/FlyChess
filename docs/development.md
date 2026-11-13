# Development Guide

The web application is a static React + TypeScript + Vite single-page app that loads the FlyWire connectome and DROSO-1 weights into a Web Worker. There is no backend server.

---

## 1. Local Development

### Requirements

- **Node.js:** `22.20+` or `24.12+` (avoid Node 23, which is outside Vitest's supported range).
- **pnpm:** `10.14.0` (pinned in `package.json`).

### Quick Start

```bash
pnpm install --frozen-lockfile
pnpm dev          # Starts Vite dev server at http://localhost:5180
pnpm check        # Runs Vitest unit tests + TypeScript typecheck + production build
```

> [!NOTE]
> Always serve the application over `localhost` or `https://`. Opening `index.html` directly via `file://` will fail because SHA-256 asset verification uses [`crypto.subtle`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/subtle) and GPU inference uses [`navigator.gpu` (WebGPU)](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/gpu), both of which require a secure browser context.

---

## 2. End-to-End Browser Tests

Two Playwright harnesses in `scripts/` launch a real Chromium instance against local servers and save screenshots and JSON reports to `reports/`:

```bash
pnpm build
CHROMIUM_PATH=/usr/bin/chromium pnpm test:fly:browser
CHROMIUM_PATH=/usr/bin/chromium pnpm test:preview
```

*(If you prefer Playwright's managed browser binary over a system Chromium, run `pnpm exec playwright install chromium` once and omit `CHROMIUM_PATH`.)*

| Script | Port | What It Verifies |
| :--- | :---: | :--- |
| **`pnpm test:fly:browser`** | `5297` | Loads the 51 MB brain via the preloader; verifies EN/PL language switching; plays a move against the fly; checks the 11-frame neural propagation trace and inter-region flow; tests hints, takebacks, 3D WebGL cloud rendering, and Stockfish post-game review; verifies all 4 fly search budgets (Scout 8, Tactician 32, Thinker 64, adaptive Sage $\le 256$); checks threefold draw claims, Fly-vs-Fly spectator mode, and non-fly bot matches; and compares WebGPU vs. CPU connectome outputs numerically when a hardware adapter is present. |
| **`pnpm test:preview`** | `4173` | Serves the production `dist/` bundle, plays a move, and verifies responsive layout (no horizontal overflow) at desktop (`1366px`) and mobile (`390px`) widths. |

---

## 3. Repository Layout

| Path | Description |
| :--- | :--- |
| `src/ai/fly/` | Connectome & weight loaders, board encoder, CPU rate dynamics (`brain.ts`), WebGPU compute shader propagator (`gpu.ts`), PUCT search (`planner.ts`), and Web Worker (`worker.ts`). |
| `src/ai/` | Bot definitions (`bots/`), turn controller (`bot-controller.ts`), Stockfish WASM wrapper (`stockfish-player.ts`), character move selection (`persona.ts`), hints, and post-game review. |
| `src/brain/` | 3D WebGL point-cloud renderer (`CloudView.ts`), inter-region flow diagram (`FlowView.ts`), playback clock, and trace statistics. |
| `src/components/` | App shell and preloader (`shell/`), game screen (`play/`), brain views (`brain/`), chessboard (`Board/`), and bot portraits. |
| `src/game/session.ts` | Game lifecycle (new game, rematch, resignation, draw claims, PGN export). |
| `src/state/` | Zustand stores (`game.ts`, `fly.ts`, `settings.ts`, `ui.ts`, `chat.ts`) with `localStorage` persistence for user preferences. |
| `src/i18n/` | English (`en.json`, default) and Polish (`pl.json`) translations. |
| `public/data/` | Compressed browser assets: FlyWire connectome (`flywire/connectome.bin.gz`) and DROSO-1 FP32 weights (`droso-1/weights.bin.gz`). |
| `artifacts/` | Standalone Python inference bundle (`droso-1/`) and archived MaleCNS prototypes (`legacy/`). |
| `training/` | Python pipeline for corpus generation, training, evaluation, and browser export. |
| `benchmarks/droso-1/` | Published rating probes, PGNs, move-regret audits, and provenance manifests. |

---

## 4. Updating the Browser Model

After training or exporting a new standalone bundle (see the [training recipe](droso-1/recipe.md)), convert it to the browser binary format (`version 2`) and regenerate the PyTorch parity fixtures:

```bash
PYTHONPATH=training python -m droso1.export_browser --bundle artifacts/droso-1
pnpm check
CHROMIUM_PATH=/usr/bin/chromium pnpm test:fly:browser
```

- `droso1.export_browser` writes `public/data/flywire/connectome.bin.gz`, `public/data/droso-1/weights.bin.gz`, their JSON manifests, and `src/ai/fly/fixtures/parity.json`.
- It automatically downloads and verifies the pinned FlyWire soma annotations (`v2.1.0`) if not cached locally (or accepts `--annotations /path/to/annotations-v2.1.0.tsv`).
- Browser manifest hashes (`sha256`) cover the decompressed binary payloads and are verified in the browser before initializing the worker.

---

## 5. Deployment & Media

### Deploying to Vercel

The production build outputs static files to `dist/`:

```bash
vercel deploy --prod
```

`vercel.json` sets a 1-year cache header on `/data/**`. Because the app fetches `model.json` and `manifest.json` fresh and validates the payload SHA-256 hashes before loading, deploying an updated model invalidates stale cached binaries cleanly.

### Regenerating README GIFs

The gameplay and 3D brain GIFs in `docs/media/` (`800×450`, 12 fps) are recorded from a live Chromium session (`ffmpeg` required):

```bash
CHROMIUM_PATH=/usr/bin/chromium pnpm media
```

*(This script updates `docs/media/gameplay.gif` and `docs/media/brain.gif`; it does not overwrite `docs/media/banner-illustrated.png`.)*
