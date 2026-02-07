<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import RemoteWrapper from '../components/RemoteWrapper.vue';

const route = useRoute();
const remoteComp = ref<any>(null);

const scopeFromRoute = () => String(route.query.scope || 'checkout');
const moduleFromRoute = () => String(route.query.module || './RemoteHome');

// attempt server-side load based on route query (scope/module)
if (process.server) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { loadRemoteServerModule } = require('~/utils/remote-loader.server');

        const tryLoad = async () => {
            const scope = scopeFromRoute();
            const mod = moduleFromRoute();
            const envKeyPath = `REMOTE_${scope.toUpperCase()}_SERVER_PATH`;
            const envKeyUrl = `REMOTE_${scope.toUpperCase()}_SERVER_URL`;
            const path = process.env[envKeyPath] || process.env[envKeyUrl] || '';

            if (!path) {
                return;
            }

            const comp = await loadRemoteServerModule(path, scope, mod);

            if (comp) {
                remoteComp.value = comp;
            }
        };

        // initial attempt
        void tryLoad();
    } catch (error) {
        console.error('Failed to load remote server module:', error);
    }
}

// Client-side: react to route changes and clear server component
watchEffect(() => {
    // reset server-provided component when route changes
    remoteComp.value = null;
});
</script>

<template>
    <div class="remote-example">
        <h1>Host Shell — Remote Feature Example</h1>
        <p>This demonstrates rendering a remote component from the selected remote.</p>

        <!-- Server-rendered remote (if available) -->
        <component v-if="remoteComp" :is="remoteComp" />

        <!-- Fallback client-side loader if SSR not available -->
        <RemoteWrapper v-else :scope="route.query.scope || 'checkout'" :module="route.query.module || './RemoteHome'" />
    </div>
</template>

<style scoped>
.remote-example {
    padding: 1rem;
}
</style>
