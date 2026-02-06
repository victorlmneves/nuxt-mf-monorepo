#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');


/**
 * Computes a Subresource Integrity (SRI) hash for a given buffer.
 * Returns a string in the format `sha256-<base64-hash>`.
 * @param {Buffer} buffer - The buffer to compute the SRI hash for.
 * @returns {string} - The computed SRI hash string.
 */
function computeSRI(buffer) {
    const hash = crypto.createHash('sha256').update(buffer).digest('base64');

    return `sha256-${hash}`;
}

/**
 * Fetches the contents of a URL and resolves with a Buffer containing the response body.
 * Rejects with an Error if the response status code is 400 or higher.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<Buffer>} - A promise that resolves with a Buffer containing the response body.
 */
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        try {
            const u = new URL(url);
            const getter = u.protocol === 'https:' ? https.get : http.get;
            getter(url, (res) => {
                if (res.statusCode && res.statusCode >= 400) {
                    return reject(new Error(`status ${res.statusCode}`));
                }

                const chunks = [];
                res.on('data', (c) => chunks.push(Buffer.from(c)));
                res.on('end', () => resolve(Buffer.concat(chunks)));
                res.on('error', reject);
            }).on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Verifies the integrity of a target resource.
 * @param {string} name - The name of the target resource.
 * @param {string} pathOrUrl - The path or URL of the target resource.
 * @param {string} expected - The expected integrity value for the target resource.
 * @returns {Promise<boolean>} - A promise that resolves with `true` if the integrity matches, or `false` otherwise.
 */
async function checkTarget(name, pathOrUrl, expected) {
    if (!pathOrUrl) {
        console.info(`[sri-verify] skipping ${name}: no path or URL provided`);

        return true;
    }

    let buffer;

    try {
        if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
            buffer = await fetchUrl(pathOrUrl);
        } else {
            buffer = fs.readFileSync(pathOrUrl);
        }
    } catch (error) {
        console.error(`[sri-verify] error fetching ${name} at ${pathOrUrl}:`, error && error.message ? error.message : error);

        return false;
    }

    const actual = computeSRI(buffer);
    console.info(`[sri-verify] ${name} computed: ${actual}`);

    if (!expected) {
        console.warn(`[sri-verify] no expected integrity provided for ${name}, computed ${actual}`);

        return true;
    }

    const parts = expected.split(',').map((s) => s.trim());

    if (!parts.includes(actual) && !parts.includes(actual.replace('sha256-', ''))) {
        console.error(`[sri-verify] integrity mismatch for ${name}: expected ${expected}, got ${actual}`);

        return false;
    }

    console.info(`[sri-verify] integrity OK for ${name}`);

    return true;
}

/**
 * Verifies the integrity of remote resources.
 * This function will exit with code 2 if any of the remotes fail the integrity check.
 * @returns {Promise<void>} - A promise that resolves when all remotes have been verified.
 */
async function main() {
    const remotes = [
        { name: 'checkout', pathEnv: 'REMOTE_CHECKOUT_SERVER_PATH', integrityEnv: 'REMOTE_CHECKOUT_SERVER_INTEGRITY' },
        { name: 'profile', pathEnv: 'REMOTE_PROFILE_SERVER_PATH', integrityEnv: 'REMOTE_PROFILE_SERVER_INTEGRITY' },
        { name: 'admin', pathEnv: 'REMOTE_ADMIN_SERVER_PATH', integrityEnv: 'REMOTE_ADMIN_SERVER_INTEGRITY' },
    ];

    let ok = true;

    for (const r of remotes) {
        const pathOrUrl = process.env[r.pathEnv] || process.env[r.pathEnv.replace('_SERVER_PATH', '')] || '';
        const expected = process.env[r.integrityEnv] || process.env[r.integrityEnv.replace('_SERVER_INTEGRITY', '')] || '';
        const result = await checkTarget(r.name, pathOrUrl, expected);

        if (!result) {
            ok = false;
        }
    }

    if (!ok) {
        process.exit(2);
    }
}

main().catch((error) => {
    console.error('sri-verify fatal error:', error && error.message ? error.message : error);

    process.exit(2);
});
