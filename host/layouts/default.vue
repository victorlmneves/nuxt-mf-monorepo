<script setup lang="ts">
import HostMenu from '~/components/HostMenu.vue';
</script>

<template>
    <div class="host-layout">
        <HostMenu />
        <main class="host-content">
            <NuxtPage />
        </main>
    </div>
</template>

<style scoped>
.host-layout {
    display: flex;
    min-height: 100vh;
    background: #fff;
}
.host-content {
    flex: 1;
    padding: 1rem;
}

@media (max-width: 768px) {
    .host-layout {
        flex-direction: column;
    }
    .host-menu {
        width: 100%;
        min-height: auto;
        border-right: none;
        border-bottom: 1px solid #e5e7eb;
    }
}
</style>
