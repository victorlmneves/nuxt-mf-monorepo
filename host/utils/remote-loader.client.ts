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

    await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = remoteUrl;
        script.type = 'text/javascript';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${remoteUrl}`));
        document.head.appendChild(script);
    });

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
