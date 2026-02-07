<script setup lang="ts">
import { ref } from 'vue';
import RemoteHome from '../components/RemoteHome.vue';

const health = ref<string | null>(null);
const loading = ref(false);
const submitting = ref(false);
const orderId = ref<string | null>(null);

async function fetchHealth() {
    try {
        const res = await fetch('/api/health');

        if (!res.ok) {
            throw new Error(String(res.status));
        }

        const json = await res.json();
        health.value = json?.status || 'ok';
    } catch (error) {
        health.value = 'unreachable';

        console.error('Failed to fetch health status:', error);
    }
}

fetchHealth();

function submitOrder() {
    submitting.value = true;

    // simulate order processing
    setTimeout(() => {
        orderId.value = `ORD-${Math.floor(Math.random() * 90000) + 10000}`;
        submitting.value = false;
    }, 900);
}
</script>

<template>
    <div class="checkout-home">
        <header>
            <h1>Checkout</h1>
            <p class="muted">Remote microfrontend — example checkout flow</p>
        </header>

        <section class="status">
            <strong>Service status:</strong>
            <span v-if="health">{{ health }}</span>
            <button @click="fetchHealth" :disabled="loading">Refresh</button>
        </section>

        <section class="cart">
            <h2>Your cart</h2>
            <ul>
                <li>Product A — €19.99</li>
                <li>Product B — €9.50</li>
            </ul>
            <button @click="submitOrder" :disabled="submitting">Place Order</button>
            <p v-if="orderId">
                Order placed:
                <strong>{{ orderId }}</strong>
            </p>
        </section>

        <section class="remote-component">
            <h3>Exposed component</h3>
            <RemoteHome />
        </section>
    </div>
</template>

<style scoped>
.checkout-home {
    padding: 1.25rem;
    font-family:
        system-ui,
        -apple-system,
        'Segoe UI',
        Roboto;
}
.muted {
    color: #666;
    margin-top: -0.25rem;
}
.status {
    margin: 0.75rem 0;
}
.cart {
    margin: 1rem 0;
    background: #f9f9f9;
    padding: 0.75rem;
    border-radius: 6px;
}
.remote-component {
    margin-top: 1rem;
}
</style>
