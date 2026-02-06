import { defineStore } from 'pinia';

export const useGlobalStore = defineStore('global', {
    state: () => ({
        user: null as null | { id: string; email?: string },
        token: '' as string,
    }),
    actions: {
        setUser(u: any) {
            this.user = u;
        },
        setToken(t: string) {
            this.token = t;
        },
        logout() {
            this.user = null;
            this.token = '';
        },
    },
});
