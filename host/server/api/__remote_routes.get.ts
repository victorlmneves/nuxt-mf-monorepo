import { defineEventHandler } from 'h3';
import { loadRemoteRoutesServer } from '../../remote-routes.server';

export default defineEventHandler(async (event) => {
    try {
        const routes = await loadRemoteRoutesServer();

        return { routes };
    } catch (err: any) {
        event.res.statusCode = 500;

        return { error: true, message: err?.message || String(err) };
    }
});
