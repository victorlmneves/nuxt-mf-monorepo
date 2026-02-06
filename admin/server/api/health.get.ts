import { defineEventHandler } from 'h3';

export default defineEventHandler(() => {
    return {
        status: 'ok',
        app: 'admin',
        pid: process.pid,
    };
});
