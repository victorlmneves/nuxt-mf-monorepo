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

    // @ts-ignore
    await (window as any).__webpack_init_sharing__('default');
    const container = (window as any)[scope];
    // @ts-ignore
    await container.init((window as any).__webpack_share_scopes__.default);

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
    const mod = factory();

    return mod && (mod.default || mod);
}
