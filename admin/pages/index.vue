<script setup lang="ts">
import RemoteHome from '../components/RemoteHome.vue';
</script>

<template>
    <div class="admin-home">
        <h1>Admin (Remote)</h1>
        <p>
             Remote component exposed:
            <strong>RemoteHome</strong>
        </p>
        <RemoteHome />
    </div>
</template>

<style scoped>
.admin-home {
    padding: 1rem;
}
</style>
