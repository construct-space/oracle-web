<script setup lang="ts">
import { onMounted, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from './components/AppShell.vue'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

onMounted(async () => {
  await auth.check()
})

watchEffect(() => {
  if (route.meta.public) return
  if (auth.checked && !auth.authenticated) {
    router.replace({ name: 'login', query: { next: route.fullPath } })
  }
})
</script>

<template>
  <RouterView v-if="route.meta.public" />
  <AppShell v-else-if="auth.checked">
    <RouterView />
  </AppShell>
  <div v-else class="min-h-screen grid place-items-center bg-[var(--app-canvas-bg)] text-[var(--app-muted)]">Loading Oracle…</div>
</template>
