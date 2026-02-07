<script setup lang="ts">
import { ref } from 'vue';
import RemoteHome from '../components/RemoteHome.vue';

const name = ref('Jane Developer');
const email = ref('jane@example.com');
const saving = ref(false);
const saved = ref(false);

function saveProfile() {
    saving.value = true;
    saved.value = false;
    setTimeout(() => {
        saving.value = false;
        saved.value = true;
        setTimeout(() => (saved.value = false), 2000);
    }, 700);
}
</script>

<template>
    <div class="profile-home">
        <header>
            <h1>Profile</h1>
            <p class="muted">Remote microfrontend — user profile editor</p>
        </header>

        <section class="editor">
            <label>
                Name
                <input v-model="name" />
            </label>

            <label>
                Email
                <input v-model="email" />
            </label>

            <div class="actions">
                <button @click="saveProfile" :disabled="saving">Save</button>
                <span v-if="saved" class="ok">Saved</span>
            </div>
        </section>

        <section class="remote-component">
            <h3>Exposed component</h3>
            <RemoteHome />
        </section>
    </div>
</template>

<style scoped>
.profile-home {
    padding: 1.25rem;
}
.muted {
    color: #666;
}
.editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 420px;
}
.editor input {
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid #ddd;
}
.actions {
    margin-top: 0.5rem;
}
.ok {
    color: green;
    margin-left: 0.5rem;
}
</style>
