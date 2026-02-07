// Temporary server-side Module Federation wrapper for `profile`.
// Provides minimal `get`/`init` APIs to allow host SSR route loading.

module.exports = {
    init: async (_shareScopes) => {},
    get: (id) => {
        if (id === './getRoutes') {
            return async () => {
                return function getRoutesFactory() {
                    return [
                        {
                            path: '/profile',
                            name: 'profile',
                            meta: {
                                remote: true,
                                scope: 'profile',
                                url: process.env.REMOTE_PROFILE_URL || 'http://localhost:3002/remoteEntry.js',
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
                            return () => 'profile remote (server-shim)';
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
