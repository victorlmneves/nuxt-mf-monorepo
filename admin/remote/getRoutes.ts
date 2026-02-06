export default function getRoutes() {
    return [
        {
            path: '/admin',
            name: 'admin',
            component: () => import('../components/RemoteHome.vue'),
        },
    ];
}
