# Nuxt 3 Microfrontend Platform

Nuxt 3 microfrontends monorepo template (Host + Remotes) using Module Federation and SSR.

## Overview

- Monorepo with Turborepo and pnpm workspaces.
- Apps: `host` (SSR shell), `checkout`, `profile`, `admin` (remotes).
- `packages/shared`: shared Pinia stores, utilities and types.

## Key files

- `host/nuxt.config.ts` — host configuration (client + server MF placeholders).
- `*/nuxt.config.ts` — remote templates (checkout/profile/admin).
- `host/remote-routes.client.ts` — client-side remote loader example.
- `host/remote-routes.server.ts` — server-side remote loader with optional fetch+eval.
- `packages/shared/types/remote.ts` — shared types for remote routes/containers.
- `start-local.sh` — local orchestrator to run host + remotes and collect logs.
- `playwright.config.ts` and `.github/workflows/e2e.yml` — E2E test skeleton.

## Useful commands (run from repository root)

```bash
pnpm install
pnpm dev:all    # start host + remotes in development
pnpm build:all  # build all apps for production
pnpm test:e2e   # run Playwright E2E tests
pnpm dev:local  # run the local orchestrator (start-local.sh)
```

## Add a new remote

1. Create a new Nuxt app (e.g. `apps/my-remote`) and copy `nuxt.config.ts` from the templates.
2. Expose components/route helpers via Module Federation (`remoteEntry.js`).
3. Point the `host` to the remote client/server `remoteEntry` URL or local path via environment variables.
4. Update root scripts (`pnpm dev:all` / `start-local.sh`) to include the new app.

## Local development

- Make the orchestrator executable and install deps:

```bash
chmod +x start-local.sh
pnpm install
```

- Start all services in background and collect logs:

```bash
./start-local.sh    # or `pnpm dev:local`
```

- Logs: `./logs/host.log`, `./logs/checkout.log`, `./logs/profile.log`, `./logs/admin.log`.

## Stopping dev servers

When you need to stop all local dev servers (host + remotes) you can run these commands on macOS/Linux.

- List processes listening on common dev ports:

```bash
lsof -nP -iTCP:3000-3010 -sTCP:LISTEN
```

- Gracefully stop processes listening on those ports:

```bash
lsof -tiTCP:3000-3010 -sTCP:LISTEN | xargs -r kill
```

- Force kill if some processes remain:

```bash
lsof -tiTCP:3000-3010 -sTCP:LISTEN | xargs -r kill -9
```

Notes:
- Be cautious with the force-kill command; it will abruptly terminate processes.
- If you use background process helpers (e.g. `turbo`, `pnpm dlx`), you may also need to stop those daemons:

```bash
pgrep -f turbo | xargs -r kill
pgrep -f 'pnpm dlx|pnpm' | xargs -r kill
```

These commands are intended for local development convenience — use carefully on systems running other services.

## Production locally

- Build everything and run in production mode:

```bash
pnpm build:all
START_MODE=prod ./start-local.sh
```

## Server-side Module Federation (SSR)

- Build each remote to include a server-side `remoteEntry.server.js`.
- Configure the `host` to point to either a local path or a reachable URL for each remote server bundle (via env vars such as `REMOTE_CHECKOUT_SERVER_PATH`).
- On SSR the host will try a local `require()` first; if a URL is provided it can fetch and safely evaluate the bundle (the loader verifies integrity if configured).

## Security notes

- Evaluating remote JS on the host is risky. Only fetch and execute bundles from trusted sources.
- The project includes SRI-based integrity checks and a small helper to compute SRI values; consider signing bundles for additional safety.

## Integrity (SRI) helper

- Compute `sha256-<base64>` for a file using the included script:

```bash
node ./scripts/generate-sri.js /absolute/path/to/checkout/.output/server/remoteEntry.server.js
# => sha256-<base64-hash>
```

- Verify locally:

```bash
REMOTE_CHECKOUT_SERVER_PATH=/abs/path/to/checkout/.output/server/remoteEntry.server.js \
REMOTE_CHECKOUT_SERVER_INTEGRITY=sha256-... \
pnpm sri:verify
```

## CI

- The E2E workflow runs `pnpm build:all` and will run an SRI verification step that reads expected integrity values from repository secrets before running tests.

## Notes & recommendations

- Strengthen TypeScript contracts between host and remotes for `getRoutes` and exported components.
- Add additional logging or telemetry as needed when debugging SSR remote loading.
- For production, prefer signed bundles + HTTPS and keep integrity values in secure storage (CI secrets).

## Dev shims & Playwright

- During early development the remotes may expose a minimal "shim" `remoteEntry.js` (under `.output/public`) instead of a full Module Federation runtime. This is expected in the template while the full MF client bundle emission is worked on.
- To run the host against those static shims locally (fast path):

```bash
# serve each remote's .output/public on ports 3001..3003 (examples)
python3 -m http.server 3001 --directory checkout/.output/public &
python3 -m http.server 3002 --directory profile/.output/public &
python3 -m http.server 3003 --directory admin/.output/public &

# then run host dev (or orchestrator)
pnpm --filter host dev # or START_MODE=dev ./start-local.sh
```

- Recommended Playwright command (uses project-installed binary):

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 ./node_modules/.bin/playwright test --config=playwright.config.ts -u
```

- Note: if you see 404s for HMR endpoints like `/__webpack_hmr/client` while using a static server, that's normal — HMR is only available when running the remote with `nuxt dev`.
