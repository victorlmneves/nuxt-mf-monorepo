// Server-side loader for remote routes using Module Federation containers available to Node.
// Enhancements:
// - integrity checks for fetched server bundles (via env var REMOTE_<NAME>_INTEGRITY)
// - verbose logging to help debug server-side loading
// - stronger typing for containers
import { existsSync } from 'fs';
import vm from 'vm';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import crypto from 'crypto';
import type { RemoteContainer, GetRoutes } from '../packages/shared/types/remote';

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

function computeSRI(code: string): string {
    const hash = crypto.createHash('sha256').update(code, 'utf8').digest('base64');
    return `sha256-${hash}`;
}

function verifyIntegrity(code: string, expected?: string): boolean {
    if (!expected) return true;
    const actual = computeSRI(code);
    const parts = expected.split(',').map((s) => s.trim());
    return parts.some((p) => p === actual || p === actual.replace('sha256-', '') || p === actual.toLowerCase());
}

export async function loadServerContainer(pathOrUrl: string, scope: string, expectedIntegrity?: string): Promise<RemoteContainer | null> {
    try {
        if (!pathOrUrl) {
            console.info(`[remote-loader] no path/url configured for remote '${scope}'`);

            return null;
        }

        // Local file path
        if (typeof pathOrUrl === 'string' && (pathOrUrl.startsWith('./') || pathOrUrl.startsWith('/'))) {
            if (!existsSync(pathOrUrl)) {
                console.warn(`[remote-loader] local path for '${scope}' not found: ${pathOrUrl}`);

                return null;
            }

            // require the remote entry which should register container on global scope
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const container = require(pathOrUrl) as RemoteContainer;

            if (container && typeof container.get === 'function') {
                console.info(`[remote-loader] loaded local container for '${scope}' from ${pathOrUrl}`);

                return container;
            }

            // Fallback: expect global[scope]
            // @ts-ignore
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
                            // @ts-ignore
                            return await (global as any).__webpack_init_sharing__(scopeName);
                        } catch (e) {
                            console.warn(
                                `[remote-loader] host __webpack_init_sharing__ error for scope ${scopeName}:`,
                                e && e.message ? e.message : e
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
                // evaluation error
                // eslint-disable-next-line no-console
                console.warn(
                    `[remote-loader] error evaluating remoteEntry for '${scope}' from ${pathOrUrl}:`,
                    error && error.message ? error.message : error
                );
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
                        // @ts-ignore
                        await (global as any).__webpack_init_sharing__('default');
                    } catch (error) {
                        console.warn(
                            `[remote-loader] error during host __webpack_init_sharing__ for 'default':`,
                            error && error.message ? error.message : error
                        );
                    }

                    if (typeof maybe.init === 'function') {
                        try {
                            // @ts-ignore
                            await maybe.init((global as any).__webpack_share_scopes__.default);
                        } catch (e) {
                            console.warn(
                                `[remote-loader] error initializing container ${scope} from ${pathOrUrl}:`,
                                e && e.message ? e.message : e
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

export async function loadRemoteRoutesServer() {
    const remotes = [
        {
            name: 'checkout',
            path: process.env.REMOTE_CHECKOUT_SERVER_PATH || '',
            integrity: process.env.REMOTE_CHECKOUT_SERVER_INTEGRITY || process.env.REMOTE_CHECKOUT_INTEGRITY || '',
        },
        {
            name: 'profile',
            path: process.env.REMOTE_PROFILE_SERVER_PATH || '',
            integrity: process.env.REMOTE_PROFILE_SERVER_INTEGRITY || process.env.REMOTE_PROFILE_INTEGRITY || '',
        },
        {
            name: 'admin',
            path: process.env.REMOTE_ADMIN_SERVER_PATH || '',
            integrity: process.env.REMOTE_ADMIN_SERVER_INTEGRITY || process.env.REMOTE_ADMIN_INTEGRITY || '',
        },
    ];

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
                const getRoutes = factory();

                if (typeof getRoutes === 'function') {
                    // stronger typing expected: GetRoutes
                    try {
                        const r = (await (getRoutes as GetRoutes)()) || [];
                        routes.push(...r);
                    } catch (err) {
                        console.warn(
                            `[remote-loader] error executing getRoutes from '${remote.name}':`,
                            err && (err as Error).message ? (err as Error).message : err
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
