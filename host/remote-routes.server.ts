// Server-side loader for remote routes using Module Federation containers available to Node.
// This implementation expects an environment variable pointing to a reachable server bundle
// for each remote (e.g. REMOTE_CHECKOUT_SERVER_PATH='/abs/path/to/checkout/remoteEntry.server.js').
// If the path is not provided or require fails, the remote is skipped.
import { existsSync } from 'fs';
import vm from 'vm';
import http from 'http';
import https from 'https';
import { URL } from 'url';

function fetchText(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const u = new URL(url);
            const getter = u.protocol === 'https:' ? https.get : http.get;

            getter(url, (res) => {
                if (res.statusCode && res.statusCode >= 400) {
                    reject(new Error(`Failed to fetch ${url}, status ${res.statusCode}`));
                    return;
                }
                const chunks: Buffer[] = [];
                res.on('data', (c) => chunks.push(Buffer.from(c)));
                res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
                res.on('error', (error) => reject(error));
            }).on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
}

export async function loadServerContainer(pathOrUrl: string, scope: string): Promise<any | null> {
    try {
        if (!pathOrUrl) {
            return null;
        }

        // Local file path
        if (typeof pathOrUrl === 'string' && (pathOrUrl.startsWith('./') || pathOrUrl.startsWith('/'))) {
            if (!existsSync(pathOrUrl)) {
                return null;
            }

            // require the remote entry which should register container on global scope
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const container = require(pathOrUrl);

            if (container && typeof container.get === 'function') {
                return container;
            }

            // Fallback: expect global[scope]
            // @ts-ignore
            return (global as any)[scope] || null;
        }

        // HTTP(S) URL: fetch and evaluate in a VM context
        if (typeof pathOrUrl === 'string' && (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://'))) {
            const code = await fetchText(pathOrUrl);

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
                            // ignore
                            console.warn(`Error in host __webpack_init_sharing__ for scope ${scopeName}:`, e && e.message ? e.message : e);
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
                console.warn(`Error evaluating remoteEntry from ${pathOrUrl}:`, error && error.message ? error.message : error);
            }

            // container could be exported via module.exports, exports, or attached to global (sandbox)
            const maybe =
                sandbox.module && sandbox.module.exports && Object.keys(sandbox.module.exports).length
                    ? sandbox.module.exports
                    : sandbox.exports && Object.keys(sandbox.exports).length
                      ? sandbox.exports
                      : sandbox[scope] || (global as any)[scope];

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
                        // ignore
                        console.warn(`Error in host __webpack_init_sharing__ for scope default:`, error && error.message ? error.message : error);
                    }

                    if (typeof maybe.init === 'function') {
                        try {
                            // @ts-ignore
                            await maybe.init((global as any).__webpack_share_scopes__.default);
                        } catch (e) {
                            // ignore init errors
                            console.warn(`Error initializing container ${scope} from ${pathOrUrl}:`, e && e.message ? e.message : e);
                        }
                    }
                } catch (error) {
                    // ignore
                    console.warn(`Error initializing container ${scope} from ${pathOrUrl}:`, error && error.message ? error.message : error);
                }

                return maybe;
            }

            return null;
        }

        return null;
    } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`Failed to load server container for ${scope} from ${pathOrUrl}:`, error && error.message ? error.message : error);

        return null;
    }
}

export async function loadRemoteRoutesServer() {
    const remotes = [
        { name: 'checkout', path: process.env.REMOTE_CHECKOUT_SERVER_PATH || '' },
        { name: 'profile', path: process.env.REMOTE_PROFILE_SERVER_PATH || '' },
        { name: 'admin', path: process.env.REMOTE_ADMIN_SERVER_PATH || '' },
    ];

    const routes: any[] = [];

    for (const remote of remotes) {
        try {
            const container = await loadServerContainer(remote.path, remote.name);

            if (!container) {
                continue;
            }

            // initialize sharing if available
            // @ts-ignore
            if (container.init && (global as any).__webpack_share_scopes__) {
                try {
                    // @ts-ignore
                    await container.init((global as any).__webpack_share_scopes__.default);
                } catch (error) {
                    // ignore
                    console.warn(`Error initializing container ${remote.name}:`, error && error.message ? error.message : error);
                }
            }

            if (typeof container.get === 'function') {
                const factory = await container.get('./getRoutes');
                const getRoutes = factory();

                if (typeof getRoutes === 'function') {
                    const r = await getRoutes();
                    routes.push(...r);
                }
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn(`Failed to load routes from remote ${remote.name}:`, error.message || error);
        }
    }

    return routes;
}
