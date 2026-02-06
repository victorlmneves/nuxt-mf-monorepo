// Load remote routes using Module Federation runtime.
// Each remote should expose a `./getRoutes` module that returns an array of Nuxt routes.
async function loadRemoteEntry(remoteUrl: string, scope: string) {
    // If the container is already loaded, return it
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

    // Initialize the share scope if available (webpack MF)
    // @ts-ignore
    await (window as any).__webpack_init_sharing__('default');
    const container = (window as any)[scope];
    // @ts-ignore
    await container.init((window as any).__webpack_share_scopes__.default);

    return container;
}

export async function loadRemoteRoutes() {
    const remotes = [
        { name: 'checkout', url: process.env.REMOTE_CHECKOUT_URL || '/checkout/remoteEntry.js' },
        { name: 'profile', url: process.env.REMOTE_PROFILE_URL || '/profile/remoteEntry.js' },
        { name: 'admin', url: process.env.REMOTE_ADMIN_URL || '/admin/remoteEntry.js' },
    ];

    const routes: any[] = [];

    for (const remote of remotes) {
        try {
            const container = await loadRemoteEntry(remote.url, remote.name);

            if (!container) {
                console.warn(`Container ${remote.name} not available at ${remote.url}`);
                continue;
            }

            const factory = await container.get('./getRoutes');
            const getRoutes = factory();

            if (typeof getRoutes === 'function') {
                const r = await getRoutes();
                routes.push(...r);
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn(`Falha ao carregar remote ${remote.name}:`, e);
        }
    }

    return routes;
}
