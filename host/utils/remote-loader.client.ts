// Client-side helper to load Module Federation remote entries and modules

/**
 * Loads a remote entry module from a specified URL and initializes its container.
 *
 * @param remoteUrl - The URL of the remote entry script to load
 * @param scope - The global scope name where the remote container will be attached
 * @returns A promise that resolves to the initialized remote container
 * @throws Error if the remote script fails to load
 */
export async function loadRemoteEntry(remoteUrl: string, scope: string) {

    if ((window as any)[scope]) {
        return (window as any)[scope];
    }

    // Retry/load with exponential backoff in case remotes are still starting
    const MAX_ATTEMPTS = 5;
    const BASE_DELAY = 200; // ms
    const MAX_DELAY = 2000; // ms

    async function sleep(ms: number) {
        return new Promise((r) => setTimeout(r, ms));
    }

    let lastErr: any = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            // remove any existing script tags for the URL before re-adding
            const existing = Array.from(document.getElementsByTagName('script')) as HTMLScriptElement[];
            for (const s of existing) {
                if (s.src && s.src.indexOf(remoteUrl) !== -1) {
                    s.remove();
                }
            }

            await new Promise<void>((resolve, reject) => {
                const script = document.createElement('script');
                script.src = remoteUrl;
                script.type = 'text/javascript';
                script.onload = () => resolve();
                script.onerror = () => reject(new Error(`Failed to load ${remoteUrl}`));
                document.head.appendChild(script);
            });

            // If script loaded, break to continue initialization
            lastErr = null;
            break;
        } catch (e) {
            lastErr = e;
            if (attempt === MAX_ATTEMPTS) break;
            const delay = Math.min(MAX_DELAY, BASE_DELAY * Math.pow(2, attempt - 1));
            console.warn(`[remote-loader] failed to load ${remoteUrl} (attempt ${attempt}): ${e && (e as any).message ? (e as any).message : e}. Retrying in ${delay}ms`);
            await sleep(delay);
        }
    }

    if (lastErr) {
        throw new Error(`Failed to load remote entry ${remoteUrl}: ${lastErr && lastErr.message ? lastErr.message : String(lastErr)}`);
    }

    // Initialize Webpack share scope if available (some shims don't provide it)
    const globalAny: any = window as any;
    if (typeof globalAny.__webpack_init_sharing__ === 'function') {
        await globalAny.__webpack_init_sharing__('default');
    } else {
        // ensure a share scope object exists so containers calling init won't fail
        globalAny.__webpack_share_scopes__ = globalAny.__webpack_share_scopes__ || { default: {} };
    }

    const container = globalAny[scope];

    if (!container) {
        throw new Error(`Failed to locate container on window for scope '${scope}' after loading ${remoteUrl}`);
    }

    // Some simple shims provide a no-op init; guard the call
    if (typeof container.init === 'function') {
        try {
            await container.init(globalAny.__webpack_share_scopes__.default);
        } catch (error) {
            // If init fails, log but allow fallback to try using exposed modules
            console.warn(`[remote-loader] container.init failed for scope ${scope}:`, error && error.message ? error.message : error);
        }
    }

    // In dev: attempt to connect to remote dev server WS to receive change notifications
    try {
        setupDevReload(remoteUrl, scope);
    } catch (error) {
        // ignore setup errors in non-dev environments
        console.warn(`[remote-loader] failed to setup dev reload for ${scope}:`, error && error.message ? error.message : error);
    }

    return container;
}

/**
 * Loads a remote module from a Module Federation container.
 * @param remoteUrl - The URL of the remote entry script to load
 * @param scope - The global scope name where the remote container will be attached
 * @param module - The name of the module to get from the remote container
 * @returns A promise that resolves with the loaded module, or null if an error occurred.
 * @throws Error if the remote script fails to load or the module is not available
 */
export async function loadRemoteModule(remoteUrl: string, scope: string, module: string) {
    const container = await loadRemoteEntry(remoteUrl, scope);

    if (!container) {
        throw new Error(`Container ${scope} not available`);
    }

    const factory = await container.get(module);
    // The factory may be async in our shims; await its result to get the actual module
    const mod = await factory();

    return mod && (mod.default || mod);
}

// ---- Dev reload helpers ----
type WSMap = { [origin: string]: WebSocket | null };
const wsByOrigin: WSMap = {};
const reloadingScopes: Record<string, boolean> = {};

function setupDevReload(remoteUrl: string, scope: string) {
    try {
        const url = new URL(remoteUrl, window.location.href);
        const hostname = url.hostname;
        const port = url.port || (url.protocol === 'https:' ? '443' : '80');

        if (!(hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1')) {
            console.info(`[remote-loader] dev reload disabled for ${scope} (${hostname})`);

            return;
        }

        const origin = `${url.protocol}//${url.hostname}:${port}`;

        if (wsByOrigin[origin]) {
            return;
        }

        const wsUrl = `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.hostname}:${port}/__remote_ws`;
        const ws = new WebSocket(wsUrl);
        wsByOrigin[origin] = ws;

        ws.addEventListener('message', async (ev) => {
            try {
                const payload = JSON.parse(ev.data);

                if (payload && payload.type === 'change') {
                    const changed = payload.path || '';

                    if (changed.endsWith('remoteEntry.js') || Object.keys(payload.sri || {}).some(p => p.endsWith('remoteEntry.js'))) {
                        console.info(`[remote-loader] dev change detected for ${scope} -> ${changed}`);

                        await reloadRemote(remoteUrl, scope);
                    }
                }
            } catch (error) {
                // ignore malformed messages
                console.warn(`[remote-loader] failed to process dev WS message for ${scope}:`, error && error.message ? error.message : error);
            }
        });

        ws.addEventListener('open', () => console.info(`[remote-loader] connected dev WS for ${origin}`));
        ws.addEventListener('error', () => { wsByOrigin[origin] = null; });
        ws.addEventListener('close', () => { wsByOrigin[origin] = null; });
    } catch (error) {
        console.warn(`[remote-loader] failed to setup dev reload for ${scope}:`, error && error.message ? error.message : error);
    }
}

async function reloadRemote(remoteUrl: string, scope: string) {
    if (reloadingScopes[scope]) {
        return;
    }

    reloadingScopes[scope] = true;

    try {
        try {
            delete (window as any)[scope];
        } catch (error) {
            console.warn(`[remote-loader] failed to delete window.${scope}:`, error && error.message ? error.message : error);

            (window as any)[scope] = undefined;
        }

        const scripts = Array.from(document.getElementsByTagName('script')) as HTMLScriptElement[];

        for (const s of scripts) {
            if (s.src && s.src.indexOf(remoteUrl) !== -1) {
                s.remove();
            }
        }

        // Re-load the remote entry
        await loadRemoteEntry(remoteUrl, scope);

        console.info(`[remote-loader] reloaded remote ${scope}`);
    } catch (error) {
        console.warn(`[remote-loader] failed to reload remote ${scope}:`, error && error.message ? error.message : error);
    } finally {
        reloadingScopes[scope] = false;
    }
}
