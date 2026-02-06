<script setup lang="ts">
import { ref } from 'vue';
import RemoteWrapper from '../components/RemoteWrapper.vue';

const remoteComp = ref<any>(null);

// attempt server-side load
if (import.meta.server) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { loadRemoteServerModule } = require('~/utils/remote-loader.server');
        // check ENV for server path or URL
        const path = process.env.REMOTE_CHECKOUT_SERVER_PATH || process.env.REMOTE_CHECKOUT_SERVER_URL || '';
        // attempt to load server component
        // note: this runs during server-rendering
        (async () => {
            const comp = await loadRemoteServerModule(path, 'checkout', './RemoteHome');

            if (comp) {
                remoteComp.value = comp;
            }
        })();
    } catch (error) {
        // ignore — fallback to client loader
        console.error('Failed to load remote server module:', error);
    }
}
</script>

<template>
    <div class="remote-example">
        <h1>Host Shell — Remote Feature Example</h1>
        <p>This demonstrates rendering a remote component from the `checkout` team.</p>

        <!-- Server-rendered remote (if available) -->
        <component v-if="remoteComp" :is="remoteComp" />

        <!-- Fallback client-side loader if SSR not available -->
        <RemoteWrapper v-else scope="checkout" module="./RemoteHome" />
    </div>
</template>

<style scoped>
.remote-example {
    padding: 1rem;
}
</style>
