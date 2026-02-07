<script setup lang="ts">
import { ref, onMounted } from 'vue'
import RemoteHome from '../components/RemoteHome.vue'

const health = ref<string | null>(null)
const metrics = ref({ activeUsers: 0, ordersToday: 0 })

async function fetchHealth() {
    try {
        const res = await fetch('/api/health')
        const json = await res.json()
        health.value = json?.status || 'ok'
    } catch (error) {
        health.value = 'unreachable'

        console.error('Failed to fetch health status:', error)
    }
}

onMounted(() => {
    fetchHealth()

    // simulate metrics
    metrics.value = { activeUsers: Math.floor(Math.random() * 300), ordersToday: Math.floor(Math.random() * 80) }
})
</script>

<template>
    <div class="admin-home">
        <header>
            <h1>Admin Dashboard</h1>
            <p class="muted">Remote microfrontend — admin controls and metrics</p>
        </header>

        <section class="status">
            <strong>Service status:</strong>
            <span>{{ health || 'loading' }}</span>
            <button @click="fetchHealth">Refresh</button>
        </section>

        <section class="metrics">
            <h2>Metrics</h2>
            <div class="cards">
                <div class="card">Active users: <strong>{{ metrics.activeUsers }}</strong></div>
                <div class="card">Orders today: <strong>{{ metrics.ordersToday }}</strong></div>
            </div>
        </section>

        <section class="remote-component">
            <h3>Exposed component</h3>
            <RemoteHome />
        </section>
    </div>
</template>

<style scoped>
.admin-home { padding: 1.25rem }
.muted { color:#666 }
.metrics .cards { display:flex; gap:0.75rem }
.card { background:#fafafa; padding:0.75rem; border-radius:6px }
</style>
