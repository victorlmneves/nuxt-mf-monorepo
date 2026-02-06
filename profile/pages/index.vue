<script setup lang="ts">
import RemoteHome from '../components/RemoteHome.vue';
</script>

<template>
    <div class="profile-home">
        <h1>Profile (Remote)</h1>
        <p>
            Componente remoto exposto:
            <strong>RemoteHome</strong>
        </p>
        <RemoteHome />
    </div>
</template>

<style scoped>
.profile-home {
    padding: 1rem;
}
</style>
