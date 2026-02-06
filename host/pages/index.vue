<template>
    <div class="host-home">
        <h1>Host (Nuxt 3 Microfrontends)</h1>
        <p>Links for remotes (running on local ports):</p>
        <ul>
            <li><a href="http://localhost:3001" target="_blank" rel="noopener">Checkout (remote)</a></li>
            <li><a href="http://localhost:3002" target="_blank" rel="noopener">Profile (remote)</a></li>
            <li><a href="http://localhost:3003" target="_blank" rel="noopener">Admin (remote)</a></li>
        </ul>
        <p>The host is configured to load remote routes via Module Federation runtime.</p>
    </div>
</template>

<style scoped>
.host-home {
    padding: 1rem;
}
</style>
