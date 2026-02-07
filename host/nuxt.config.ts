// Host Nuxt config com Module Federation (Webpack)

export default {
    compatibilityDate: '2026-02-06',
    ssr: true,
    builder: 'webpack',
    runtimeConfig: {
        public: {
            REMOTE_CHECKOUT_URL: process.env.REMOTE_CHECKOUT_URL || 'http://localhost:3001/remoteEntry.js',
            REMOTE_PROFILE_URL: process.env.REMOTE_PROFILE_URL || 'http://localhost:3002/remoteEntry.js',
            REMOTE_ADMIN_URL: process.env.REMOTE_ADMIN_URL || 'http://localhost:3003/remoteEntry.js',
        },
    },
    build: {
        extend(config: any, { isClient, isServer }: any) {
            config.plugins = config.plugins || [];

            // Dynamically require webpack at runtime to avoid top-level imports
            let ModuleFederationPlugin: any = null;

            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const webpack = require('webpack');
                ModuleFederationPlugin = webpack?.container?.ModuleFederationPlugin;
            } catch (error) {
                // webpack might not be available in all environments (or during config evaluation)
                // In that case, skip adding the Module Federation plugin and log a warning.
                // Nuxt build will fail later if webpack is required but missing; ensure devs install it.
                // Use console.warn so messages are visible during build/config load.
                // @ts-ignore
                console.warn('webpack not available; skipping ModuleFederationPlugin setup', error && error.message);
            }

            if (ModuleFederationPlugin && isClient) {
                // Client-side Module Federation (loads remoteEntry.js via script)
                config.plugins.push(
                    new ModuleFederationPlugin({
                        name: 'host',
                        remotes: {
                            checkout: `checkout@${process.env.REMOTE_CHECKOUT_URL || 'http://localhost:3001/remoteEntry.js'}`,
                            profile: `profile@${process.env.REMOTE_PROFILE_URL || 'http://localhost:3002/remoteEntry.js'}`,
                            admin: `admin@${process.env.REMOTE_ADMIN_URL || 'http://localhost:3003/remoteEntry.js'}`,
                        },
                        shared: {
                            vue: { singleton: true, eager: false, requiredVersion: false },
                            pinia: { singleton: true, eager: false, requiredVersion: false },
                        },
                    })
                );
            }

            if (ModuleFederationPlugin && isServer) {
                // Server-side Module Federation (Node/CommonJS)
                // Ensure output library is compatible with Node require
                config.output = config.output || {};
                config.output.library = { type: 'commonjs-module' };

                config.plugins.push(
                    new ModuleFederationPlugin({
                        name: 'host',
                        filename: 'remoteEntry.server.js',
                        remotes: {
                            // Expect server remote entries to be available via env vars (file path or URL)
                            checkout:
                                process.env.REMOTE_CHECKOUT_SERVER ||
                                `checkout@${process.env.REMOTE_CHECKOUT_URL || 'http://localhost:3001/remoteEntry.js'}`,
                            profile:
                                process.env.REMOTE_PROFILE_SERVER ||
                                `profile@${process.env.REMOTE_PROFILE_URL || 'http://localhost:3002/remoteEntry.js'}`,
                            admin:
                                process.env.REMOTE_ADMIN_SERVER ||
                                `admin@${process.env.REMOTE_ADMIN_URL || 'http://localhost:3003/remoteEntry.js'}`,
                        },
                        shared: {
                            vue: { singleton: true, eager: false, requiredVersion: false },
                            pinia: { singleton: true, eager: false, requiredVersion: false },
                        },
                    })
                );
            }
        },
    },
} as any;
