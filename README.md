# Nuxt 3 Microfrontend Platform
## nuxt-mf-monorepo

Monorepo with Nuxt 3, SSR, Auth0, Webpack Module Federation and microfrontends.

Projeto template Nuxt 3 Microfrontends (Monorepo + Module Federation)

Visão geral
- Monorepo com Turborepo
- Apps: `host` (SSR shell, auth), `checkout`, `profile`, `admin` (remotes)
- `packages/shared`: stores Pinia, utils e types partilhados

Principais ficheiros adicionados
- `host/nuxt.config.ts` — configuração do `host` (SSR + Module Federation placeholders)
- `checkout/nuxt.config.ts`, `profile/nuxt.config.ts`, `admin/nuxt.config.ts` — templates para remotes
- `host/remote-routes.client.ts` — carregamento dinâmico de rotas remotas no cliente
- `packages/shared/stores/global.ts` — store `Pinia` partilhado
- `.env.example` em cada app (host, checkout, profile, admin)
- `host/vercel.json` e `*/netlify.toml` (remotes) — configs de deploy
- `playwright.config.ts` e `.github/workflows/e2e.yml` — esqueleto E2E

Comandos úteis (no root)
```bash
pnpm install
pnpm dev:all    # executa host + remotes em dev
pnpm build:all  # build para produção
pnpm test:e2e   # executa Playwright E2E
```

Como adicionar um novo remote
1. Criar nova app (ex.: `apps/my-remote`) com `nuxt.config.ts` baseado nos templates.
2. Expor componentes/rotas via Module Federation (configurar `remoteEntry.js`).
3. Adicionar URL do `remoteEntry` nas variáveis de ambiente do `host`.
4. Atualizar o `pnpm dev:all` / scripts conforme necessário.

Notas
- Este repositório fornece templates e placeholders. Ajuste o `Module Federation` plugin/webpack conforme a implementação escolhida.
- Testar cuidadosamente hydratation/SSR com Module Federation.

 Quer que eu ajuste os `package.json` scripts ou configure o `pnpm dev:all` automaticamente agora?

**Desenvolvimento local**

- Tornar o script executável e instalar dependências:

```bash
chmod +x start-local.sh
pnpm install
```

- Iniciar todos os serviços (host + remotes) em background e gravar logs em `./logs`:

```bash
```md
# Nuxt 3 Microfrontend Platform
## nuxt-mf-monorepo

Monorepo template demonstrating Nuxt 3 microfrontends (Module Federation) with SSR.

Overview
- Monorepo using Turborepo / pnpm workspaces
- Applications: `host` (SSR shell, optional auth), `checkout`, `profile`, `admin` (remotes)
- `packages/shared`: shared Pinia stores, utils and types

Key files and locations
- `host/nuxt.config.ts` — host Nuxt config with Module Federation examples (client + server)
- `checkout/nuxt.config.ts`, `profile/nuxt.config.ts`, `admin/nuxt.config.ts` — remote templates
- `host/remote-routes.client.ts` — client-side remote loader example
- `host/remote-routes.server.ts` — server-side remote loader (attempts local `require` and supports fetch+eval)
- `packages/shared/stores/global.ts` — shared `Pinia` store example
- `.env.example` available in each app (host and remotes)
- `host/vercel.json` and `*/netlify.toml` — example deployment files
- `playwright.config.ts` and `.github/workflows/e2e.yml` — E2E test skeleton (Playwright + GitHub Actions)

Useful commands (run from repository root)
```bash
pnpm install
pnpm dev:all    # start host + remotes in development
pnpm build:all  # build all apps for production
pnpm test:e2e   # run Playwright E2E tests
```

Adding a new remote
1. Create a new Nuxt app (e.g. `apps/my-remote`) using `nuxt.config.ts` from the provided templates.
2. Expose components and route helpers via Module Federation (`remoteEntry.js`).
3. Point the `host` to the remote client/server `remoteEntry` URL or local path via environment variables.
4. Update root scripts (`pnpm dev:all`) if you add new apps to the monorepo.

Local development

- Make the orchestrator script executable and install dependencies:

```bash
chmod +x start-local.sh
pnpm install
```

- Start all services (host + remotes) in background and collect logs in `./logs`:
```bash
pnpm dev:local
# or
./start-local.sh
```

- Logs written by `start-local.sh`:
  - `./logs/host.log`
  - `./logs/checkout.log`
  - `./logs/profile.log`
  - `./logs/admin.log`


Run services in production mode locally

You can start built apps (production server) locally by using the `start:prod` scripts added to each remote and the host. Use the `START_MODE` environment variable to control which scripts `start-local.sh` runs:

- `START_MODE=dev` (default) — runs `pnpm --filter <app> dev` for each app.
- `START_MODE=prod` — runs `pnpm --filter <app> start:prod` for each app (uses `nuxt start`).

Example: build and run the monorepo in production mode locally

```bash
pnpm build:all
START_MODE=prod ./start-local.sh
```

Or run only the host in production mode:

```bash
pnpm --filter host build
START_MODE=prod pnpm --filter host start:prod
```
- Start a single app for development:

```bash
pnpm dev:host
pnpm dev:checkout
```

- Stop: press `Ctrl+C` in the terminal running `pnpm dev:local`, or kill background PIDs listed in the logs.

CI / GitHub Actions — health checks and secrets

The included E2E workflow runs a health-check step (`pnpm health:all`) before running tests. If your services are not running on the default local ports in CI, set repository secrets or workflow `env` values to point the health-checks at the correct endpoints.

Recommended environment variables for CI or local overrides:

- `HEALTH_TIMEOUT_MS`: timeout in milliseconds for health checks (example: `10000`).
- `HOST_HEALTH`, `CHECKOUT_HEALTH`, `PROFILE_HEALTH`, `ADMIN_HEALTH`: full URLs to each app's `/api/health` endpoint if not using the default `http://localhost:3000...3003` locations.

Example workflow environment block:

```yaml
env:
  HEALTH_TIMEOUT_MS: ${{ secrets.HEALTH_TIMEOUT_MS }}
  HOST_HEALTH: ${{ secrets.HOST_HEALTH }}
  CHECKOUT_HEALTH: ${{ secrets.CHECKOUT_HEALTH }}
  PROFILE_HEALTH: ${{ secrets.PROFILE_HEALTH }}
  ADMIN_HEALTH: ${{ secrets.ADMIN_HEALTH }}
```

Server-side Module Federation (SSR)

This template includes examples of configuring Module Federation for both client and server bundles. To enable server-side rendering of remote components, follow these steps:

1. Build each remote including a server-side `remoteEntry.server.js`. The remote `nuxt.config.ts` files generate server-side entries for the remote container.
2. Point the `host` at either a local file path or a URL for each remote server bundle using environment variables. Example local usage:

```bash
REMOTE_CHECKOUT_SERVER_PATH=/absolute/path/to/checkout/.output/server/remoteEntry.server.js \
REMOTE_PROFILE_SERVER_PATH=/absolute/path/to/profile/.output/server/remoteEntry.server.js \
REMOTE_ADMIN_SERVER_PATH=/absolute/path/to/admin/.output/server/remoteEntry.server.js \
pnpm dev:host
```

3. On server-side rendering, the `host` loader tries to `require()` the server entry if a file path is provided. If a URL is supplied, the loader can fetch and evaluate the remote bundle at runtime (see `host/remote-routes.server.ts` for the implementation). After loading, the host initializes the remote container share-scopes to ensure shared modules resolve correctly.

Important security note

Executing remote JavaScript on the host (fetch+eval) is inherently risky. Only fetch and execute server bundles from trusted sources and consider adding integrity checks, signatures, or other validation before evaluating remote code in production.

Recommendations and next steps

- Add robust integrity checks for any fetched server bundles before eval.
- Add detailed logging in `host/remote-routes.server.ts` when debugging server-side loading.
- Add stronger TypeScript contracts between host and remotes for `getRoutes` and exported components.

For questions or if you want me to automatically update `package.json` scripts or add more detailed examples, tell me which part to adjust next.
```
