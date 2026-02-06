# Module Federation Guide (Internal)

Objetivo: orientar equipas sobre como implementar um remote para trabalhar com a shell `host`.

1) Contratos mínimos
- Exportar `./getRoutes` (módulo) que devolve `Array<RemoteRoute>` onde `RemoteRoute` tem `path`, `name`, `component` (lazy import OK).
- Expor componentes que a shell possa consumir, por exemplo `./RemoteHome`.

2) Builds
- Client: gerar `remoteEntry.js` (exposed modules) — usado pelo client-side MF.
- Server: gerar `remoteEntry.server.js` compatível com Node (commonjs) — usado para SSR pela shell.

3) Partilha de dependências
- Marcar `vue` e `pinia` como `shared` singleton para evitar múltiplas instâncias.

4) Contratos TypeScript
- Definir interfaces em `packages/shared/types/remote.ts` e exportar via `@nuxt-mf/shared`.

5) Testes e E2E
- Fornecer `GET /api/health` para checks automáticos.
- Fornecer storybook ou página de demo local para QA.

6) Deploy
- Deployar `remoteEntry.js` e `remoteEntry.server.js` para artefactos que a shell possa consumir.

7) Segurança
- Os bundles server avaliados via URL são executados no host — só usar fontes confiáveis.
