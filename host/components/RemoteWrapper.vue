<script setup lang="ts">
import { shallowRef, computed, onMounted, watch } from 'vue';
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

let _loadToken = 0;

async function doLoad() {
    const token = ++_loadToken;
    loading.value = true;
    error.value = null;

    try {
        const config = useRuntimeConfig();
        const publicKey = `REMOTE_${props.scope.toUpperCase()}_URL`;
        let envUrl: string | undefined = undefined;

        try {
            envUrl = config?.public?.[publicKey];
        } catch (error) {
            console.error(`Failed to read config for ${publicKey}:`, error);
        }

        const url = props.url || envUrl || `http://localhost:${3000 + (['checkout', 'profile', 'admin'].indexOf(props.scope) + 1)}/remoteEntry.js`;
        const comp = await loadRemoteModule(url, props.scope, props.module);

        if (token !== _loadToken) {
            return; // stale
        }

        component.value = comp && (comp.default || comp);
    } catch (err: any) {
        error.value = err && err.message ? err.message : String(err);
    } finally {
        if (_loadToken) {
            loading.value = false;
        }
    }
}

onMounted(() => {
    doLoad();
});

function retry() {
    // allow user to trigger a manual retry of loading the remote
    error.value = null;
    component.value = null;
    doLoad();
}

// React to prop changes (client-side navigation) and reload remote component
watch(() => [props.scope, props.module, props.url], () => {
    // reset and load again
    component.value = null;
    doLoad();
});
</script>

<template>
    <div>
        <component v-if="component" :is="component" v-bind="passProps" />
        <div v-else-if="loading">Loading remote...</div>
        <div v-else-if="error">
            <slot name="fallback">
                <div>
                    <div>Failed to load remote: {{ error }}</div>
                    <button @click="retry" :disabled="loading">
                        <span v-if="loading" class="rw-spinner" aria-hidden="true"></span>
                        {{ loading ? 'Retrying...' : 'Retry' }}
                    </button>
                </div>
            </slot>
        </div>
        <div v-else><slot /></div>
    </div>
</template>

<style scoped>
.rw-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0,0,0,0.15);
  border-top-color: rgba(0,0,0,0.6);
  border-radius: 50%;
  margin-right: 6px;
  animation: rw-spin 0.8s linear infinite;
}
@keyframes rw-spin { to { transform: rotate(360deg); } }
button[disabled] { opacity: 0.7; cursor: not-allowed; }
</style>
