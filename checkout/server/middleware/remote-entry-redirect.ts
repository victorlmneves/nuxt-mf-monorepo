import { defineEventHandler, sendRedirect } from 'h3';

export default defineEventHandler((event) => {
    const reqUrl = event.node.req.url || '';

    // Only redirect the exact remoteEntry path to the webpack asset path in dev.
    if (reqUrl === '/remoteEntry.js') {
        return sendRedirect(event, '/_nuxt/remoteEntry.js', 302);
    }
});
