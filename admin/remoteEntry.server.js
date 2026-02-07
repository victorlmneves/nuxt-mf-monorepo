// Temporary server-side Module Federation wrapper for `admin`.

module.exports = {
    init: async (_shareScopes) => {},
    get: (id) => {
        if (id === './getRoutes') {
            return async () => {
                return function getRoutesFactory() {
                    return [
                        {
                            path: '/admin',
                            name: 'admin',
                            meta: {
                                remote: true,
                                scope: 'admin',
                                url: process.env.REMOTE_ADMIN_URL || 'http://localhost:3003/remoteEntry.js',
                            },
                        },
                    ];
                };
            };
        }

        return async () => {
            throw new Error('Module not exposed: ' + id);
        };
    },
};
