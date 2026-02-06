import { defineEventHandler } from 'h3';

export default defineEventHandler(() => {
    return {
        status: 'ok',
        app: 'profile',
        pid: process.pid,
    };
});
