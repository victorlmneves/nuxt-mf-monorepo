// Temporary server-side Module Federation wrapper for `checkout`.
// Exports a minimal container API (`get`, `init`) so the host can
// load `./getRoutes` during SSR without requiring a full webpack
// remoteEntry.server build. This is a short-term shim for local
// development and tests.

// Temporary server-side Module Federation wrapper for `checkout`.
// Exports a minimal container API (`get`, `init`) so the host can
// load `./getRoutes` during SSR without requiring a full webpack
// remoteEntry.server build. This is a short-term shim for local
// development and tests.

module.exports = {
    init: async (_shareScopes) => {
        // no-op initialization
    },
    get: (id) => {
        if (id === './getRoutes') {
            return async () => {
                return function getRoutesFactory() {
                    return [
                        {
                            path: '/checkout',
                            name: 'checkout',
                            // metadata describing how the host should load this remote on the client
                            meta: {
                                remote: true,
                                scope: 'checkout',
                                url: process.env.REMOTE_CHECKOUT_URL || 'http://localhost:3001/remoteEntry.js',
                            },
                        },
                    ];
                };
            };
        }

        if (id === './RemoteHome') {
            return async () => {
                return {
                    default: {
                        setup() {
                            return () => 'checkout remote (server-shim)';
                        }
                    }
                };
            };
        }

        return async () => {
            throw new Error('Module not exposed: ' + id);
        };
    },
};
