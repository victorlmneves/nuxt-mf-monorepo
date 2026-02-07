<template>
    <div class="host-home">
        <h1>Host (Nuxt 3 Microfrontends)</h1>
        <p>Links for remotes (running on local ports):</p>
        <ul>
            <li><NuxtLink to="/remote-example?scope=checkout">Checkout (render in host)</NuxtLink></li>
            <li><NuxtLink to="/remote-example?scope=profile">Profile (render in host)</NuxtLink></li>
            <li><NuxtLink to="/remote-example?scope=admin">Admin (render in host)</NuxtLink></li>
        </ul>
        <p>The host is configured to load remote routes via Module Federation runtime.</p>
    </div>
</template>

<style scoped>
.host-home {
    padding: 1rem;
}
</style>
