// Remote admin com Module Federation (exposes básicos)
export default {
    ssr: false,
    builder: 'webpack',
    app: { baseURL: '/' },
    build: {
        extend(config: any, { isClient, isServer }: any) {
            config.plugins = config.plugins || [];

            // Require webpack at runtime to avoid config-time resolution errors
            let ModuleFederationPlugin: any = null;
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const webpack = require('webpack');
                ModuleFederationPlugin = webpack?.container?.ModuleFederationPlugin;
            } catch (e) {
                // @ts-ignore
                console.warn('webpack not available; skipping ModuleFederationPlugin setup', e && e.message);
            }

            if (ModuleFederationPlugin && isClient) {
                config.plugins.push(
                    new ModuleFederationPlugin({
                        name: 'admin',
                        filename: 'remoteEntry.js',
                        exposes: {
                            './getRoutes': './remote/getRoutes.ts',
                        },
                        shared: {
                            vue: { singleton: true, eager: false, requiredVersion: false },
                            pinia: { singleton: true, eager: false, requiredVersion: false },
                        },
                    })
                );
            }

            if (ModuleFederationPlugin && isServer) {
                config.output = config.output || {};
                config.output.library = { type: 'commonjs-module' };
                config.plugins.push(
                    new ModuleFederationPlugin({
                        name: 'admin',
                        filename: 'remoteEntry.server.js',
                        exposes: {
                            './getRoutes': './remote/getRoutes.ts',
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
