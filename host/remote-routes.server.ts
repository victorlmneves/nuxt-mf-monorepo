// Server-side loader for remote routes using Module Federation containers available to Node.
// Enhancements:
// - integrity checks for fetched server bundles (via env var REMOTE_<NAME>_INTEGRITY)
// - verbose logging to help debug server-side loading
// - stronger typing for containers
import { existsSync } from 'fs';
import path from 'path';
import vm from 'vm';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import crypto from 'crypto';
import type { RemoteContainer, GetRoutes } from '../packages/shared/types/remote';

/**
 * Fetches the contents of a URL and resolves with an object containing the response body as a string and optionally the response status code.
 * Rejects with an Error if the response status code is 400 or higher.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<{ code: string; status?: number }>} - A promise that resolves with an object containing the response body as a string and optionally the response status code.
 */
function fetchText(url: string): Promise<{ code: string; status?: number }> {
    return new Promise((resolve, reject) => {
        try {
            const u = new URL(url);
            const getter = u.protocol === 'https:' ? https.get : http.get;

            getter(url, (res) => {
                const status = res.statusCode || 0;

                if (status >= 400) {
                    reject(new Error(`Failed to fetch ${url}, status ${status}`));
                    return;
                }

                const chunks: Buffer[] = [];
                res.on('data', (c) => chunks.push(Buffer.from(c)));
                res.on('end', () => resolve({ code: Buffer.concat(chunks).toString('utf8'), status }));
                res.on('error', (error) => reject(error));
            }).on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Computes a Subresource Integrity (SRI) hash for a given code string.
 * Returns a string in the format `sha256-<base64-hash>`.
 * @param {string} code - The code string to compute the SRI hash for.
 * @returns {string} - The computed SRI hash string.
 */
function computeSRI(code: string): string {
    const hash = crypto.createHash('sha256').update(code, 'utf8').digest('base64');

    return `sha256-${hash}`;
}

/**
 * Verifies the integrity of a code string against an expected SRI hash.
 * Returns true if the code matches the expected integrity, false otherwise.
 * If no expected integrity is provided, returns true.
 * Note: the expected integrity can be a comma-separated list of SRI hashes.
 * The actual integrity is computed using {@link computeSRI}.
 * The actual integrity is matched against the expected integrity values
 * case-insensitively, and also against the values without the 'sha256-' prefix.
 */
function verifyIntegrity(code: string, expected?: string): boolean {
    if (!expected) {
        return true;
    }

    const actual = computeSRI(code);
    const parts = expected.split(',').map((s) => s.trim());

    return parts.some((p) => p === actual || p === actual.replace('sha256-', '') || p === actual.toLowerCase());
}

/**
 * Loads a remote container from a local file path or URL.
 * Performs an integrity check if an expected SRI hash is provided.
 * If the container is successfully loaded, it is initialized with the host's share scopes object.
 * If the container exposes an `init` function, it is called with the host's share scopes object.
 *
 * @param {string} pathOrUrl - The local file path or URL of the remote container.
 * @param {string} scope - The name of the remote container.
 * @param {string} [expectedIntegrity] - The expected SRI hash for the remote container.
 * @returns {Promise<RemoteContainer | null>} - A promise that resolves with the loaded container,
 *   or null if an error occurred.
 */
export async function loadServerContainer(pathOrUrl: string, scope: string, expectedIntegrity?: string): Promise<RemoteContainer | null> {
    try {
        if (!pathOrUrl) {
            console.info(`[remote-loader] no path/url configured for remote '${scope}'`);

            return null;
        }

        // Local file path
        if (typeof pathOrUrl === 'string' && (pathOrUrl.startsWith('./') || pathOrUrl.startsWith('/'))) {
            let resolved = pathOrUrl;

            if (!existsSync(resolved)) {
                // Try common workspace-relative fallback locations (useful for local dev wrappers)
                const repoRootCandidate = path.resolve(__dirname, '..', '..');
                const candidates = [
                    path.resolve(repoRootCandidate, 'checkout', 'remoteEntry.server.js'),
                    path.resolve(repoRootCandidate, 'profile', 'remoteEntry.server.js'),
                    path.resolve(repoRootCandidate, 'admin', 'remoteEntry.server.js'),
                ];

                const found = candidates.find((c) => existsSync(c));

                if (found) {
                    resolved = found;

                    console.info(`[remote-loader] using fallback wrapper for '${scope}' at ${resolved}`);
                } else {
                    console.warn(`[remote-loader] local path for '${scope}' not found: ${pathOrUrl}`);

                    return null;
                }
            }

            // attempt to load CommonJS module even when running in ESM/Nitro
            let container: RemoteContainer | null = null;

            try {
                console.info(`[remote-loader] attempting to load local wrapper for '${scope}' from ${resolved}`);

                // First try to load via Node's createRequire (works in ESM runtimes)
                try {
                    try {
                        const modModule = await import('module');
                        const createRequire = (modModule as any).createRequire;

                        if (typeof createRequire === 'function') {
                            const req = createRequire(resolved);

                            try {
                                const mod = req(resolved);

                                if (mod) {
                                    container = mod as RemoteContainer;

                                    console.info(`[remote-loader] loaded local wrapper for '${scope}' via createRequire`);
                                }
                            } catch (error) {
                                console.debug(`[remote-loader] createRequire require failed for ${resolved}:`, error && error.message ? error.message : error);
                            }
                        }
                    } catch (error) {
                        console.debug(`[remote-loader] createRequire import failed for ${resolved}:`, error && error.message ? error.message : error);
                    }

                    if (!container) {
                        // Next try dynamic import (works in ESM runtimes and will load CJS modules with a default export)
                        try {
                            const urlMod = await import('url');
                            const { pathToFileURL } = urlMod as any;
                            const mod = await import(pathToFileURL(resolved).href);
                            const m = (mod && (mod.default || mod));

                            if (m) {
                                container = m as RemoteContainer;

                                console.info(`[remote-loader] loaded local wrapper for '${scope}' via dynamic import`);
                            }
                        } catch (error) {
                            console.debug(`[remote-loader] dynamic import failed for ${resolved}:`, error && error.message ? error.message : error);
                        }
                    }

                    if (!container) {
                        // Read and evaluate the file in a VM sandbox to avoid require/import issues
                        const fs = await import('fs');
                        const code = (fs as any).readFileSync(resolved, 'utf8');

                        // best-effort require for sandbox (may be undefined in ESM contexts)
                        let sandboxRequire: any = undefined;

                        try {
                            const modModule = await import('module');
                            const createRequire = (modModule as any).createRequire;

                            if (typeof createRequire === 'function') {
                                sandboxRequire = createRequire(resolved);
                            }
                        } catch (error) {
                            console.debug(`[remote-loader] createRequire import failed for sandbox in ${resolved}:`, error && error.message ? error.message : error);
                        }

                        const sandbox: any = {
                            module: { exports: {} },
                            exports: {},
                            require: sandboxRequire,
                            console: console,
                            process: process,
                            Buffer: Buffer,
                            global: {},
                            __dirname: path.dirname(resolved),
                            __filename: resolved,
                            __webpack_init_sharing__: async (scopeName: string) => {
                                if (typeof (global as any).__webpack_init_sharing__ === 'function') {
                                    try {
                                        return await (global as any).__webpack_init_sharing__(scopeName);
                                    } catch (error) {
                                        console.warn(`[remote-loader] __webpack_init_sharing__ failed for ${scopeName}:`, error && error.message ? error.message : error);
                                    }
                                }

                                if (!(global as any).__webpack_share_scopes__) {
                                    (global as any).__webpack_share_scopes__ = { default: {} };
                                }

                                return Promise.resolve();
                            },
                            __webpack_share_scopes__: (global as any).__webpack_share_scopes__,
                        };

                        sandbox.global = sandbox;
                        const context = vm.createContext(sandbox);
                        const script = new vm.Script(code, { filename: resolved });
                        script.runInContext(context);

                        const maybe =
                            sandbox.module && sandbox.module.exports && Object.keys(sandbox.module.exports).length
                                ? sandbox.module.exports
                                : sandbox.exports && Object.keys(sandbox.exports).length
                                ? sandbox.exports
                                : sandbox[scope] || (global as any)[scope];

                        container = maybe as RemoteContainer;

                        if (!container) {
                            console.warn(`[remote-loader] did not find container API for '${scope}' after evaluating ${resolved}`);

                            return null;
                        }

                        console.info(`[remote-loader] loaded local wrapper for '${scope}' via VM evaluation`);
                    }
                } catch (error) {
                    console.warn(`[remote-loader] failed to evaluate ${resolved} for '${scope}':`, error && error.message ? error.message : error);
                    console.debug(error && (error as Error).stack ? (error as Error).stack : error);

                    return null;
                }
            } catch (error) {
                console.warn(`[remote-loader] failed to evaluate ${resolved} for '${scope}':`, error && error.message ? error.message : error);
                console.debug(error && (error as Error).stack ? (error as Error).stack : error);

                return null;
            }

            if (container && typeof container.get === 'function') {
                console.info(`[remote-loader] loaded local container for '${scope}' from ${pathOrUrl}`);

                return container;
            }

            // Fallback: expect global[scope]
            const globalContainer = (global as any)[scope] as RemoteContainer | undefined;

            if (globalContainer && typeof globalContainer.get === 'function') {
                console.info(`[remote-loader] found container on global scope for '${scope}'`);

                return globalContainer;
            }

            console.warn(`[remote-loader] local container for '${scope}' did not expose expected API`);

            return null;
        }

        // HTTP(S) URL: fetch and evaluate in a VM context
        if (typeof pathOrUrl === 'string' && (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://'))) {
            console.info(`[remote-loader] fetching remoteEntry for '${scope}' from ${pathOrUrl}`);
            const { code, status } = await fetchText(pathOrUrl);
            console.debug(`[remote-loader] fetched ${code.length} bytes for '${scope}' (status ${status || 'unknown'})`);

            if (!verifyIntegrity(code, expectedIntegrity)) {
                console.warn(
                    `[remote-loader] integrity mismatch for '${scope}'. Expected ${expectedIntegrity || '<none>'}, computed ${computeSRI(code)}`
                );

                return null;
            }

            // ensure host has a share scopes object
            if (!(global as any).__webpack_share_scopes__) {
                (global as any).__webpack_share_scopes__ = { default: {} };
            }

            const sandbox: any = {
                module: { exports: {} },
                exports: {},
                require: require,
                console: console,
                process: process,
                Buffer: Buffer,
                global: {},
                __dirname: '/',
                __filename: pathOrUrl,
                // expose webpack helpers to the sandbox so bundles can initialize sharing
                __webpack_init_sharing__: async (scopeName: string) => {
                    // noop or forward to host if available
                    if (typeof (global as any).__webpack_init_sharing__ === 'function') {
                        try {
                            return await (global as any).__webpack_init_sharing__(scopeName);
                        } catch (error) {
                            console.warn(
                                `[remote-loader] host __webpack_init_sharing__ error for scope ${scopeName}:`,
                                error && error.message ? error.message : error
                            );
                        }
                    }

                    if (!(global as any).__webpack_share_scopes__) {
                        (global as any).__webpack_share_scopes__ = { default: {} };
                    }

                    return Promise.resolve();
                },
                __webpack_share_scopes__: (global as any).__webpack_share_scopes__,
            };

            // make global refer to sandbox.global for code that expects globalThis/global
            sandbox.global = sandbox;

            const context = vm.createContext(sandbox);

            try {
                const script = new vm.Script(code, { filename: pathOrUrl });
                script.runInContext(context);
            } catch (error) {
                console.warn(
                    `[remote-loader] error evaluating remoteEntry for '${scope}' from ${pathOrUrl}:`,
                    error && error.message ? error.message : error
                );
                console.debug(error && (error as Error).stack ? (error as Error).stack : error);
            }

            // container could be exported via module.exports, exports, or attached to global (sandbox)
            const maybe =
                sandbox.module && sandbox.module.exports && Object.keys(sandbox.module.exports).length
                    ? (sandbox.module.exports as RemoteContainer)
                    : sandbox.exports && Object.keys(sandbox.exports).length
                      ? (sandbox.exports as RemoteContainer)
                      : (sandbox[scope] as RemoteContainer) || (global as any)[scope];

            if (maybe && typeof maybe.get === 'function') {
                // attempt to initialize sharing on host if possible
                try {
                    if (!(global as any).__webpack_share_scopes__) {
                        (global as any).__webpack_share_scopes__ = { default: {} };
                    }

                    if (typeof (global as any).__webpack_init_sharing__ !== 'function') {
                        (global as any).__webpack_init_sharing__ = async (_: string) => Promise.resolve();
                    }

                    // call global initializer first (some bundles expect it)
                    try {
                        await (global as any).__webpack_init_sharing__('default');
                    } catch (error) {
                        console.warn(
                            `[remote-loader] error during host __webpack_init_sharing__ for 'default':`,
                            error && error.message ? error.message : error
                        );
                    }

                    if (typeof maybe.init === 'function') {
                        try {
                            await maybe.init((global as any).__webpack_share_scopes__.default);
                        } catch (error) {
                            console.warn(
                                `[remote-loader] error initializing container ${scope} from ${pathOrUrl}:`,
                                error && error.message ? error.message : error
                            );
                        }
                    }
                } catch (error) {
                    console.warn(
                        `[remote-loader] error initializing container ${scope} from ${pathOrUrl}:`,
                        error && error.message ? error.message : error
                    );
                }

                console.info(`[remote-loader] loaded remote container for '${scope}' from ${pathOrUrl}`);

                return maybe as RemoteContainer;
            }

            console.warn(`[remote-loader] did not find container API for '${scope}' after evaluation from ${pathOrUrl}`);

            return null;
        }

        return null;
    } catch (error) {
        console.warn(
            `[remote-loader] failed to load server container for ${scope} from ${pathOrUrl}:`,
            error && error.message ? error.message : error
        );

        return null;
    }
}

/**
 * Loads remote routes from all configured remotes.
 * Returns an array of route objects with shape { name: string, path: string, meta?: any }
 * @returns {Promise<any[]>} - A promise that resolves with an array of route objects
 */
export async function loadRemoteRoutesServer() {
    const repoRoot = path.resolve(process.cwd());
    const remotes = [
        {
            name: 'checkout',
            path:
                process.env.REMOTE_CHECKOUT_SERVER_PATH ||
                (existsSync(path.resolve(repoRoot, 'checkout', 'remoteEntry.server.js')) ? path.resolve(repoRoot, 'checkout', 'remoteEntry.server.js') : ''),
            integrity: process.env.REMOTE_CHECKOUT_SERVER_INTEGRITY || process.env.REMOTE_CHECKOUT_INTEGRITY || '',
        },
        {
            name: 'profile',
            path:
                process.env.REMOTE_PROFILE_SERVER_PATH ||
                (existsSync(path.resolve(repoRoot, 'profile', 'remoteEntry.server.js')) ? path.resolve(repoRoot, 'profile', 'remoteEntry.server.js') : ''),
            integrity: process.env.REMOTE_PROFILE_SERVER_INTEGRITY || process.env.REMOTE_PROFILE_INTEGRITY || '',
        },
        {
            name: 'admin',
            path:
                process.env.REMOTE_ADMIN_SERVER_PATH ||
                (existsSync(path.resolve(repoRoot, 'admin', 'remoteEntry.server.js')) ? path.resolve(repoRoot, 'admin', 'remoteEntry.server.js') : ''),
            integrity: process.env.REMOTE_ADMIN_SERVER_INTEGRITY || process.env.REMOTE_ADMIN_INTEGRITY || '',
        },
    ];

    console.info('[remote-loader] remotes to load (server):', remotes.map(r => ({ name: r.name, path: r.path })));

    const routes: any[] = [];

    for (const remote of remotes) {
        try {
            const container = await loadServerContainer(remote.path, remote.name, remote.integrity || undefined);

            if (!container) {
                console.info(`[remote-loader] skipping remote '${remote.name}' (no container)`);

                continue;
            }

            // initialize sharing if available
            if (container.init && (global as any).__webpack_share_scopes__) {
                try {
                    await container.init((global as any).__webpack_share_scopes__.default);
                } catch (error) {
                    console.warn(
                        `[remote-loader] error initializing share scope for '${remote.name}':`,
                        error && error.message ? error.message : error
                    );
                }
            }

            if (typeof container.get === 'function') {
                const factory = await container.get('./getRoutes');
                console.info(`[remote-loader] ./getRoutes factory type for '${remote.name}':`, typeof factory);
                console.info(`[remote-loader] invoking factory for '${remote.name}'`);

                let maybeModuleOrFn: any = undefined;

                try {
                    // factory may be sync or async and may return a function or a module-like object
                    maybeModuleOrFn = await Promise.resolve(factory());
                } catch (error) {
                    console.warn(`[remote-loader] factory invocation for '${remote.name}' threw:`, error && (error as Error).message ? (error as Error).message : error);

                    continue;
                }

                console.info(`[remote-loader] ./getRoutes factory result type for '${remote.name}':`, typeof maybeModuleOrFn);

                // Resolve common shapes: function, { default: function }, { getRoutes: function }
                let getRoutesFn: any = null;

                if (typeof maybeModuleOrFn === 'function') {
                    getRoutesFn = maybeModuleOrFn;
                } else if (maybeModuleOrFn && typeof maybeModuleOrFn.default === 'function') {
                    getRoutesFn = maybeModuleOrFn.default;
                } else if (maybeModuleOrFn && typeof maybeModuleOrFn.getRoutes === 'function') {
                    getRoutesFn = maybeModuleOrFn.getRoutes;
                }

                if (typeof getRoutesFn === 'function') {
                    try {
                        const maybeRoutes = await Promise.resolve(getRoutesFn());
                        const r = (maybeRoutes as any) || [];

                        if (Array.isArray(r)) {
                            routes.push(...r);
                        } else {
                            console.warn(`[remote-loader] getRoutes from '${remote.name}' did not return an array`);
                        }
                    } catch (error) {
                        console.warn(
                            `[remote-loader] error executing getRoutes from '${remote.name}':`,
                            error && (error as Error).message ? (error as Error).message : error
                        );
                    }
                } else {
                    console.warn(`[remote-loader] remote '${remote.name}' exported ./getRoutes but it did not return a function`);
                }
            }
        } catch (error) {
            console.warn(
                `[remote-loader] failed to load routes from remote ${remote.name}:`,
                error && (error as Error).message ? (error as Error).message : error
            );
        }
    }

    return routes;
}
