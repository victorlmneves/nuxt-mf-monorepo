import { defineEventHandler } from 'h3';

export default defineEventHandler(() => {
    return {
        status: 'ok',
        app: 'host',
        pid: process.pid,
    };
});
