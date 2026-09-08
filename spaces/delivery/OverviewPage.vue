<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { type DeliveryStats, getStats } from './api'

const stats = ref<DeliveryStats | null>(null)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    stats.value = await getStats()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load stats'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Overview</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Mail delivery posture across every tenant — messages, domains, and API keys.
      </p>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !stats" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <template v-else-if="stats">
      <div class="grid gap-4 md:grid-cols-3">
        <RouterLink
          to="/delivery/messages"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 hover:bg-[var(--app-card-hover)] transition-colors flex flex-col gap-2"
        >
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">MESSAGES</div>
          <div class="text-3xl font-semibold">{{ stats.messages.total }}</div>
          <div class="flex flex-wrap gap-2 text-xs text-[var(--app-muted)]">
            <span><strong class="text-emerald-600">{{ stats.messages.sent }}</strong> sent</span>
            <span><strong class="text-sky-600">{{ stats.messages.queued }}</strong> queued</span>
            <span><strong class="text-amber-600">{{ stats.messages.failed }}</strong> failed</span>
            <span><strong class="text-rose-500">{{ stats.messages.bounced }}</strong> bounced</span>
          </div>
        </RouterLink>

        <RouterLink
          to="/delivery/domains"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 hover:bg-[var(--app-card-hover)] transition-colors flex flex-col gap-2"
        >
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">DOMAINS</div>
          <div class="text-3xl font-semibold">{{ stats.domains.total }}</div>
          <div class="text-xs text-[var(--app-muted)]">
            <strong class="text-emerald-600">{{ stats.domains.verified }}</strong> verified ·
            <strong>{{ stats.domains.total - stats.domains.verified }}</strong> pending
          </div>
        </RouterLink>

        <RouterLink
          to="/delivery/api-keys"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 hover:bg-[var(--app-card-hover)] transition-colors flex flex-col gap-2"
        >
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">API KEYS</div>
          <div class="text-3xl font-semibold">{{ stats.keys.total }}</div>
          <div class="text-xs text-[var(--app-muted)]">Issued delivery credentials across all tenants.</div>
        </RouterLink>
      </div>
    </template>
  </section>
</template>
