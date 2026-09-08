<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { type DomainsStats, getStats } from './api'

const stats = ref<DomainsStats | null>(null)
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
        Portfolio-wide registrar posture — active domains, upcoming renewals, configured redirects.
      </p>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !stats" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <template v-else-if="stats">
      <div class="grid gap-4 md:grid-cols-4">
        <RouterLink
          to="/domains/list"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 hover:bg-[var(--app-card-hover)] transition-colors flex flex-col gap-2"
        >
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">DOMAINS</div>
          <div class="text-3xl font-semibold">{{ stats.domains.total }}</div>
          <div class="text-xs text-[var(--app-muted)]">
            <strong class="text-emerald-600">{{ stats.domains.active }}</strong> active ·
            <strong class="text-rose-500">{{ stats.domains.expired }}</strong> expired
          </div>
        </RouterLink>

        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-2">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">EXPIRING &lt;30d</div>
          <div class="text-3xl font-semibold" :class="stats.domains.expiring_soon > 0 ? 'text-amber-600' : ''">
            {{ stats.domains.expiring_soon }}
          </div>
          <div class="text-xs text-[var(--app-muted)]">Renewal window.</div>
        </div>

        <RouterLink
          to="/domains/redirects"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 hover:bg-[var(--app-card-hover)] transition-colors flex flex-col gap-2"
        >
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">REDIRECTS</div>
          <div class="text-3xl font-semibold">{{ stats.redirects }}</div>
          <div class="text-xs text-[var(--app-muted)]">Configured URL forwardings.</div>
        </RouterLink>

        <RouterLink
          to="/domains/tenants"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 hover:bg-[var(--app-card-hover)] transition-colors flex flex-col gap-2"
        >
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">TENANTS</div>
          <div class="text-3xl font-semibold">{{ stats.tenants }}</div>
          <div class="text-xs text-[var(--app-muted)]">Distinct owners.</div>
        </RouterLink>
      </div>
    </template>
  </section>
</template>
