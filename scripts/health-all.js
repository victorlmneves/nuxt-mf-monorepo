#!/usr/bin/env node
const urls = [
    { name: 'host', url: process.env.HOST_HEALTH || 'http://localhost:3000/api/health' },
    { name: 'checkout', url: process.env.CHECKOUT_HEALTH || 'http://localhost:3001/api/health' },
    { name: 'profile', url: process.env.PROFILE_HEALTH || 'http://localhost:3002/api/health' },
    { name: 'admin', url: process.env.ADMIN_HEALTH || 'http://localhost:3003/api/health' },
];

const timeoutMs = parseInt(process.env.HEALTH_TIMEOUT_MS || '5000', 10);

/**
 * Checks the health of a single service.
 * @param {object} entry - an object with 'name' and 'url' properties
 * @returns {Promise<boolean>} - a promise that resolves to true if the service is healthy, false otherwise
 */
async function checkOne(entry) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(entry.url, { signal: controller.signal });
        clearTimeout(id);

        if (!res.ok) {
            console.error(`${entry.name} -> HTTP ${res.status}`);

            return false;
        }

        const json = await res.json().catch(() => null);
        console.log(`${entry.name} -> ok`, json || '');

        return true;
    } catch (error) {
        clearTimeout(id);
        console.error(`${entry.name} -> error: ${error.message}`);

        return false;
    }
}

(async () => {
    let allOk = true;

    for (const u of urls) {
        const ok = await checkOne(u);

        if (!ok) {
            allOk = false;
        }
    }

    if (!allOk) {
        console.error('One or more services unhealthy');

        process.exit(1);
    }

    console.log('All services healthy');

    process.exit(0);
})();
