<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { type DomainsTenant, listTenants } from './api'

const tenants = ref<DomainsTenant[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    tenants.value = (await listTenants()).tenants ?? []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load tenants'
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return tenants.value
  return tenants.value.filter((t) => t.user_uuid.toLowerCase().includes(q))
})

const totals = computed(() => {
  const acc = { tenants: tenants.value.length, domains: 0, redirects: 0, expiringSoon: 0 }
  for (const t of tenants.value) {
    acc.domains += t.domains
    acc.redirects += t.redirects
    acc.expiringSoon += t.expiring_soon
  }
  return acc
})

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* ignored */
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Tenants</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Per-user domain footprint. Sorted by total domains — top rows are your biggest customers.
      </p>
    </div>

    <div class="grid gap-3 md:grid-cols-4">
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">TENANTS</div>
        <div class="text-2xl font-semibold">{{ totals.tenants }}</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">DOMAINS</div>
        <div class="text-2xl font-semibold">{{ totals.domains }}</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">REDIRECTS</div>
        <div class="text-2xl font-semibold">{{ totals.redirects }}</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">EXPIRING &lt;30d</div>
        <div class="text-2xl font-semibold" :class="totals.expiringSoon > 0 ? 'text-amber-600' : ''">
          {{ totals.expiringSoon }}
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Filter by user UUID…"
        class="w-full bg-transparent text-sm outline-none placeholder:text-[var(--app-muted)]"
      />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !tenants.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="filtered.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] overflow-hidden"
    >
      <div class="grid grid-cols-[1.4fr_repeat(3,minmax(0,1fr))] gap-2 px-5 py-2 text-[11px] tracking-wider text-[var(--app-muted)] border-b border-[var(--app-border)] mono">
        <div>TENANT</div>
        <div class="text-right">DOMAINS</div>
        <div class="text-right">REDIRECTS</div>
        <div class="text-right">EXPIRING &lt;30d</div>
      </div>
      <div class="divide-y divide-[color:var(--app-border)]">
        <div
          v-for="t in filtered"
          :key="t.user_uuid"
          class="grid grid-cols-[1.4fr_repeat(3,minmax(0,1fr))] gap-2 items-center px-5 py-3"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div class="size-8 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
              <Icon icon="lucide:user" class="size-4" />
            </div>
            <code
              class="text-xs font-mono truncate cursor-pointer hover:text-[var(--app-foreground)]"
              :title="t.user_uuid + ' (click to copy)'"
              @click="copy(t.user_uuid)"
            >{{ shortId(t.user_uuid) }}</code>
          </div>
          <div class="text-sm font-semibold text-right">{{ t.domains }}</div>
          <div class="text-sm text-right">{{ t.redirects }}</div>
          <div class="text-sm text-right" :class="t.expiring_soon > 0 ? 'text-amber-600 font-semibold' : 'text-[var(--app-muted)]'">
            {{ t.expiring_soon }}
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:users" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">
        {{ search ? 'No tenants match your filter' : 'No registered domains yet' }}
      </div>
    </div>
  </section>
</template>
