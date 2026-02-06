<script setup lang="ts">
import RemoteHome from '../components/RemoteHome.vue';
</script>

<template>
    <div class="checkout-home">
        <h1>Checkout (Remote)</h1>
        <p>
            Remote component exposed:
            <strong>RemoteHome</strong>
        </p>
        <RemoteHome />
    </div>
</template>

<style scoped>
.checkout-home {
    padding: 1rem;
}
</style>
