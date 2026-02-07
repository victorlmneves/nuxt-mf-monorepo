import { defineNuxtPlugin } from '#app';
import { adaptRemoteRoute } from '../utils/remote-route-adapter';

export default defineNuxtPlugin(async (nuxtApp) => {
    // Only run in client
    if (!process.client) {
        return;
    }

    try {
        // Fetch routes from host server API
        const res = await fetch('/api/__remote_routes');

        if (!res.ok) {
            return;
        }

        const data = await res.json();
        const routes = data?.routes || [];

        for (const r of routes) {
            const adapted = adaptRemoteRoute(r);

            if (adapted) {
                try {
                    // Register route dynamically
                    // @ts-ignore - use internal router
                    nuxtApp.$router?.addRoute(adapted);
                } catch (error) {
                    // fallback: use addRoute on router instance
                    const router = nuxtApp.vueApp?.config?.globalProperties?.$router;
                    router?.addRoute && router.addRoute(adapted);

                    console.warn(`Failed to add remote route ${adapted.path}:`, error);
                }
            }
        }
    } catch (error) {
        // ignore — non-critical
        console.warn('remote-routes plugin failed', error && error.message ? error.message : error);
    }
});
