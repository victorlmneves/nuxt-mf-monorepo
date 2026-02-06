// Exports as default a function that returns the routes of this remote.

export default function getRoutes() {
    return [
        {
            path: '/checkout',
            name: 'checkout',
            component: () => import('../components/RemoteHome.vue'),
        },
    ];
}
