export default function getRoutes() {
    return [
        {
            path: '/profile',
            name: 'profile',
            component: () => import('../components/RemoteHome.vue'),
        },
    ];
}
