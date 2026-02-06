import { defineEventHandler } from 'h3';

export default defineEventHandler(() => {
    return {
        status: 'ok',
        app: 'checkout',
        pid: process.pid,
    };
});
