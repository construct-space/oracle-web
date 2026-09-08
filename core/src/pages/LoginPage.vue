<script setup lang="ts">
import { Alert, Button, Card, Input, InputPassword } from '@construct-space/ui-web'
import ConstructLogo from '@core/components/ConstructLogo.vue'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.login(email.value, password.value)
    const next = typeof route.query.next === 'string' && route.query.next ? route.query.next : '/admin/administrators'
    router.replace(next)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="grid min-h-screen place-items-center bg-[var(--app-canvas-bg)] p-8">
    <form class="w-full max-w-[520px]" @submit.prevent="submit">
      <Card padding="md">
        <div class="mb-4 flex items-center gap-3">
          <div class="grid size-12 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] text-[var(--app-accent)]">
            <ConstructLogo :size="26" />
          </div>
          <div>
            <p class="mono text-xs font-bold uppercase tracking-wider text-[var(--app-muted)]">Construct staff</p>
            <h1 class="text-4xl font-black tracking-tight text-[var(--app-foreground)]">Oracle Admin</h1>
          </div>
        </div>
        <p class="mt-3 text-base leading-7 text-[var(--app-muted)]">
          Sign in with your Oracle administrator account. This auth flow uses Oracle's own <code>administrators</code> table.
        </p>

        <div class="mt-6 grid grid-cols-1 gap-3">
          <Input v-model="email" type="email" placeholder="Email" autocomplete="username" />
          <InputPassword v-model="password" placeholder="Password" autocomplete="current-password" />
        </div>

        <Alert v-if="error" class="mt-3" color="error" variant="soft" :description="error" />

        <Button class="mt-4" block :loading="loading" label="Sign in" />

        <p class="mt-4 text-sm leading-6 text-[var(--app-muted)]">
          After login, Oracle opens on the Administrators page so you can verify staff access first.
        </p>
      </Card>
    </form>
  </div>
</template>
