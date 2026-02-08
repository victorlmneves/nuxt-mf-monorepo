import { loadServerContainer } from '../remote-routes.server';

export async function loadRemoteServerModule(pathOrUrl: string, scope: string, moduleName: string) {
    const envKey = `REMOTE_${scope.toUpperCase()}_INTEGRITY`;
    const expected = process.env[envKey] || process.env[`REMOTE_${scope.toUpperCase()}`] || undefined;
    const container = await loadServerContainer(pathOrUrl, scope, expected);

    if (!container) {
        return null;
    }

    // initialize sharing if available on host
    try {
        if ((global as any).__webpack_init_sharing__) {
            await (global as any).__webpack_init_sharing__('default');
        }
    } catch (error) {
        console.warn(`[remote-loader] failed to init sharing on host:`, error && error.message ? error.message : error);
    }

    if (typeof container.get === 'function') {
        try {
            const factory = await container.get(moduleName);
            const mod = factory();

            return mod && (mod.default || mod);
        } catch (error) {
            console.warn(`Failed to load module ${moduleName} from ${scope}:`, error && error.message ? error.message : error);

            return null;
        }
    }

    return null;
}
