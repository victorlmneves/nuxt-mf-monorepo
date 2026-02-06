// Exporta por default uma função que retorna as rotas deste remote.
export default function getRoutes() {
  return [
    {
      path: '/checkout',
      name: 'checkout',
      component: () => import('../components/RemoteHome.vue')
    }
  ]
}
