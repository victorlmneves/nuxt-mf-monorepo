const fs = require('fs');
const path = require('path');

const remotes = ['checkout', 'profile', 'admin'];
let exitCode = 0;

// Patterns that likely indicate a Module Federation remote/container
const MF_PATTERNS = [
    'webpack/container',
    'container.init(',
    'remoteEntry',
    'ModuleFederationPlugin',
    '__webpack_require__.f.remotes',
    'window["webpackJsonp"]',
];

function containsMfPattern(buf) {
    const s = String(buf);

    return MF_PATTERNS.some((p) => s.includes(p));
}

for (const r of remotes) {
    try {
        const publicDir = path.resolve(__dirname, '..', r, '.output', 'public');

        if (!fs.existsSync(publicDir)) {
            console.warn(`[copy-remote-entries] public directory not found for ${r}: ${publicDir}`);

            exitCode = 1;

            continue;
        }

        const destRoot = path.join(publicDir, 'remoteEntry.js');

        if (fs.existsSync(destRoot)) {
            console.info(`[copy-remote-entries] remoteEntry already present for ${r} at ${destRoot}`);

            continue;
        }

        // Candidate: top-level public/_nuxt/remoteEntry.js
        const candidate1 = path.join(publicDir, '_nuxt', 'remoteEntry.js');

        if (fs.existsSync(candidate1)) {
            fs.copyFileSync(candidate1, destRoot);

            console.info(`[copy-remote-entries] copied ${candidate1} -> ${destRoot}`);

            continue;
        }

        // Search the _nuxt dir for any file that looks like a remote bundle by name or content
        const _nuxtDir = path.join(publicDir, '_nuxt');

        if (fs.existsSync(_nuxtDir)) {
            const files = fs.readdirSync(_nuxtDir);

            // quick name-based match first
            const nameMatch = files.find((f) => /remoteEntry|remote-entry|mf-?remote/i.test(f));

            if (nameMatch) {
                const src = path.join(_nuxtDir, nameMatch);
                fs.copyFileSync(src, destRoot);

                console.info(`[copy-remote-entries] copied by name ${src} -> ${destRoot}`);

                continue;
            }

            // content-based scan (read first N bytes to avoid huge memory usage)
            let foundByContent = null;

            for (const f of files) {
                const filePath = path.join(_nuxtDir, f);

                try {
                    const stat = fs.statSync(filePath);
                    const sizeToRead = Math.min(stat.size, 128 * 1024); // 128 KB
                    const fd = fs.openSync(filePath, 'r');
                    const buffer = Buffer.alloc(sizeToRead);
                    fs.readSync(fd, buffer, 0, sizeToRead, 0);
                    fs.closeSync(fd);

                    if (containsMfPattern(buffer)) {
                        foundByContent = f;

                        break;
                    }
                } catch (error) {
                    console.warn(
                        `[copy-remote-entries] failed to read ${filePath} for content scan:`,
                        error && error.message ? error.message : error
                    );
                }
            }

            if (foundByContent) {
                const src = path.join(_nuxtDir, foundByContent);
                fs.copyFileSync(src, destRoot);

                console.info(`[copy-remote-entries] copied by content ${src} -> ${destRoot}`);

                continue;
            }
        }

        console.warn(`[copy-remote-entries] no remoteEntry.js found for ${r} (looked in ${candidate1} and ${_nuxtDir})`);

        exitCode = 1;
    } catch (error) {
        console.error(`[copy-remote-entries] failed for ${r}:`, error && error.message ? error.message : error);

        exitCode = 1;
    }
}

process.exit(exitCode);
