<script setup lang="ts">
import { shallowRef, computed, onMounted } from 'vue';
import { loadRemoteModule } from '~/utils/remote-loader.client';
import { useRuntimeConfig } from '#app';

interface IProps {
    scope: string;
    module: string;
    url?: string;
}

const props = defineProps<IProps>();
const component = shallowRef<any>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const passProps = computed(() => ({}));

onMounted(async () => {
    loading.value = true;
    try {
        // Read client-safe runtime config (exposed by Nuxt) for remote URLs
        const config = useRuntimeConfig();
        const publicKey = `REMOTE_${props.scope.toUpperCase()}_URL`;
        let envUrl: string | undefined = undefined;

        try {
            envUrl = config?.public?.[publicKey];
        } catch (error) {
            console.error(`Failed to read config for ${publicKey}:`, error);
        }

        const url =
            props.url || envUrl || `http://localhost:${3000 + (['checkout', 'profile', 'admin'].indexOf(props.scope) + 1)}/remoteEntry.js`;
        const comp = await loadRemoteModule(url, props.scope, props.module);
        // Prefer the default export when present (ModuleFederation exposes modules as { default: ... })
        component.value = comp && (comp.default || comp);
    } catch (err: any) {
        error.value = err && err.message ? err.message : String(err);
    } finally {
        loading.value = false;
    }
});
</script>

<template>
    <div>
        <component v-if="component" :is="component" v-bind="passProps" />
        <div v-else-if="loading">Loading remote...</div>
        <div v-else-if="error">Failed to load remote: {{ error }}</div>
        <div v-else><slot /></div>
    </div>
</template>
