<template>
    <div class="host-home">
        <h1>Host (Nuxt 3 Microfrontends)</h1>
        <p>Links para remotes (executados em portas locais):</p>
        <ul>
            <li><a href="http://localhost:3001" target="_blank" rel="noopener">Checkout (remote)</a></li>
            <li><a href="http://localhost:3002" target="_blank" rel="noopener">Profile (remote)</a></li>
            <li><a href="http://localhost:3003" target="_blank" rel="noopener">Admin (remote)</a></li>
        </ul>
        <p>O host está configurado para carregar rotas remotas via Module Federation runtime.</p>
    </div>
</template>

<style scoped>
.host-home {
    padding: 1rem;
}
</style>
