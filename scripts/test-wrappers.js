// Simple test script to load the temporary server wrappers and call ./getRoutes
const path = require('path');

async function testWrapper(p) {
    try {
        const wrapper = require(path.resolve(p));

        if (!wrapper || typeof wrapper.get !== 'function') {
            console.error(p, 'does not export get()');

            return;
        }

        const factory = await wrapper.get('./getRoutes');
        const getRoutes = factory();
        const routes = await (typeof getRoutes === 'function' ? getRoutes() : getRoutes);

        console.log(p, '->', routes);
    } catch (error) {
        console.error('Error loading', p, error && error.stack ? error.stack : error);
    }
}

(async () => {
    await testWrapper('./checkout/remoteEntry.server.js');
    await testWrapper('./profile/remoteEntry.server.js');
    await testWrapper('./admin/remoteEntry.server.js');
})();
