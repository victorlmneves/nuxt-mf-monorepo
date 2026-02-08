// Remote checkout com Module Federation (exposes)

export default {
    compatibilityDate: '2026-02-06',
    // NOTE: temporary hack — enabling SSR so the build emits a server-side
    // `remoteEntry.server.js` which the host can load for SSR. This repo
    // initially used `ssr: false` for remotes, but the host expects a
    // server bundle for server-side route loading. Keep this temporary
    // hook and the empty CSS until a proper builder/plugin fix is added.
    // TODO: remove hack after confirming ModuleFederationPlugin emits
    // server entries correctly with Nuxt's webpack builder.
    ssr: true,
    builder: 'webpack',
    app: { baseURL: '/' },
    css: [
        // include a small CSS entry to ensure Nuxt emits styles.mjs for server builds
        '~/assets/css/empty.css',
    ],
    hooks: {
        // Temporary fallback: create `styles.mjs` before build if missing.
        // This prevents Nitro rollup from failing when the webpack builder
        // does not emit server-side style modules. It's a short-term
        // workaround — remove once the builder/plugin chain reliably
        // produces `styles.mjs` during the Nuxt build.
        'build:before'() {
            try {
                const fs = require('fs');
                const path = require('path');
                const dir = path.resolve(__dirname, '.nuxt', 'dist', 'server');
                fs.mkdirSync(dir, { recursive: true });
                const file = path.join(dir, 'styles.mjs');

                if (!fs.existsSync(file)) {
                    fs.writeFileSync(file, 'export default {}');
                }
            } catch (error) {
                console.warn('Failed to create styles.mjs fallback:', error && error.message);
            }
        },
    },
    build: {
        extend(config: any, { isClient, isServer }: any) {
            config.plugins = config.plugins || [];

            // Require webpack at runtime to avoid config-time resolution errors
            let ModuleFederationPlugin: any = null;

            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const webpack = require('webpack');
                ModuleFederationPlugin = webpack?.container?.ModuleFederationPlugin;
            } catch (error) {
                console.warn('webpack not available; skipping ModuleFederationPlugin setup', error && error.message);
            }

            if (ModuleFederationPlugin && isClient) {
                config.plugins.push(
                    new ModuleFederationPlugin({
                        name: 'checkout',
                        filename: 'remoteEntry.js',
                        exposes: {
                            './getRoutes': './remote/getRoutes.ts',
                            './RemoteHome': './components/RemoteHome.vue',
                        },
                        shared: {
                            vue: { singleton: true, eager: false, requiredVersion: false },
                            pinia: { singleton: true, eager: false, requiredVersion: false },
                        },
                    })
                );

                // Ensure the emitted remoteEntry is copied to a public-facing path
                const fs = require('fs');
                const path = require('path');

                class CopyRemoteEntryToPublicPlugin {
                    apply(compiler: any) {
                        // First, try to copy from the in-memory assets (new webpack emit flow)
                        compiler.hooks.thisCompilation.tap('CopyRemoteEntryToPublicPlugin', (compilation: any) => {
                            const tap = compilation.hooks.processAssets && compilation.hooks.processAssets.tap;

                            if (tap) {
                                tap(
                                    {
                                        name: 'CopyRemoteEntryToPublicPlugin',
                                        stage: compilation.constructor.PROCESS_ASSETS_STAGE_SUMMARIZE || 1000,
                                    },
                                    (assets: any) => {
                                        try {
                                            const keys = Object.keys(assets || compilation.assets || {});
                                            const candidate = keys.find((k: string) => k && k.includes('remoteEntry') && k.endsWith('.js'));

                                            if (candidate) {
                                                const output =
                                                    (assets &&
                                                        assets[candidate] &&
                                                        assets[candidate].source &&
                                                        assets[candidate].source()) ||
                                                    (compilation.assets &&
                                                        compilation.assets[candidate] &&
                                                        compilation.assets[candidate].source());

                                                if (output) {
                                                    const dest = path.resolve(process.cwd(), '.output', 'public', 'remoteEntry.js');
                                                    fs.mkdirSync(path.dirname(dest), { recursive: true });
                                                    fs.writeFileSync(dest, output);

                                                    console.info('[checkout] copied emitted', candidate, '->', dest);
                                                }
                                            }
                                        } catch (error) {
                                            console.warn('[checkout] failed to copy remoteEntry from assets:', error && error.message);
                                        }
                                    }
                                );
                            }
                        });

                        // As a fallback, after files are emitted to disk, scan the compiler output directory
                        compiler.hooks.afterEmit.tapAsync('CopyRemoteEntryToPublicPlugin', (compilation: any, callback: any) => {
                            try {
                                const outDir =
                                    compiler && compiler.options && compiler.options.output && compiler.options.output.path
                                        ? compiler.options.output.path
                                        : path.resolve(process.cwd(), '.nuxt', 'dist', 'client');

                                if (fs.existsSync(outDir)) {
                                    const files = fs.readdirSync(outDir);
                                    const candidate = files.find((f: string) => f && f.includes('remoteEntry') && f.endsWith('.js'));

                                    if (candidate) {
                                        const src = path.join(outDir, candidate);
                                        const dest = path.resolve(process.cwd(), '.output', 'public', 'remoteEntry.js');
                                        fs.mkdirSync(path.dirname(dest), { recursive: true });
                                        fs.copyFileSync(src, dest);
                                        console.info('[checkout] copied emitted file from disk', src, '->', dest);
                                    }
                                }
                            } catch (error) {
                                console.warn('[checkout] failed to copy remoteEntry from disk:', error && error.message);
                            } finally {
                                callback();
                            }
                        });
                    }
                }

                config.plugins.push(new CopyRemoteEntryToPublicPlugin());
            }

            if (ModuleFederationPlugin && isServer) {
                config.output = config.output || {};
                config.output.library = { type: 'commonjs-module' };
                config.plugins.push(
                    new ModuleFederationPlugin({
                        name: 'checkout',
                        filename: 'remoteEntry.server.js',
                        exposes: {
                            './getRoutes': './remote/getRoutes.ts',
                            './RemoteHome': './components/RemoteHome.vue',
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
