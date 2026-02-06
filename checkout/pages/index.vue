<template>
  <div class="checkout-home">
    <h1>Checkout (Remote)</h1>
    <p>Componente remoto exposto: <strong>RemoteHome</strong></p>
    <RemoteHome />
  </div>
</template>

<script setup lang="ts">
import RemoteHome from '../components/RemoteHome.vue'
</script>

<style scoped>
.checkout-home { padding: 1rem }
</style>
