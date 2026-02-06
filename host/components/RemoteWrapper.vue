<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { loadRemoteModule } from '~/utils/remote-loader.client';

interface IProps {
    scope: string;
    module: string;
    url?: string;
}

const props = defineProps<IProps>();
const component = ref<any>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const passProps = computed(() => ({}));

onMounted(async () => {
    loading.value = true;
    try {
        const url = props.url || (process.env[`REMOTE_${props.scope.toUpperCase()}_URL`] as any) || `/` + props.scope + `/remoteEntry.js`;
        const comp = await loadRemoteModule(url, props.scope, props.module);
        component.value = comp;
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
