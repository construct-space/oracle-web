<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { type DeliveryTenant, listTenants } from './api'

const tenants = ref<DeliveryTenant[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await listTenants()
    tenants.value = res.tenants ?? []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load tenants'
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return tenants.value
  return tenants.value.filter((t) => t.user_id.toLowerCase().includes(q))
})

const totals = computed(() => {
  const acc = { tenants: tenants.value.length, messages: 0, domains: 0, keys: 0 }
  for (const t of tenants.value) {
    acc.messages += t.messages_total
    acc.domains += t.domains
    acc.keys += t.keys
  }
  return acc
})

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

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
        Per-user delivery footprint. Sorted by message volume — the top of the list is who's leaning on the service hardest.
      </p>
    </div>

    <!-- Totals strip -->
    <div class="grid gap-3 md:grid-cols-4">
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">TENANTS</div>
        <div class="text-2xl font-semibold">{{ totals.tenants }}</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">MESSAGES</div>
        <div class="text-2xl font-semibold">{{ totals.messages }}</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">DOMAINS</div>
        <div class="text-2xl font-semibold">{{ totals.domains }}</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">API KEYS</div>
        <div class="text-2xl font-semibold">{{ totals.keys }}</div>
      </div>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Filter by user id…"
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
      <div class="grid grid-cols-[1.4fr_repeat(5,minmax(0,1fr))] gap-2 px-5 py-2 text-[11px] tracking-wider text-[var(--app-muted)] border-b border-[var(--app-border)] mono">
        <div>TENANT</div>
        <div class="text-right">MESSAGES</div>
        <div class="text-right">SENT / FAIL</div>
        <div class="text-right">DOMAINS</div>
        <div class="text-right">KEYS</div>
        <div class="text-right">LAST SEND</div>
      </div>
      <div class="divide-y divide-[color:var(--app-border)]">
        <div
          v-for="t in filtered"
          :key="t.user_id"
          class="grid grid-cols-[1.4fr_repeat(5,minmax(0,1fr))] gap-2 items-center px-5 py-3"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div class="size-8 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
              <Icon icon="lucide:user" class="size-4" />
            </div>
            <code
              class="text-xs font-mono truncate cursor-pointer hover:text-[var(--app-foreground)]"
              :title="t.user_id + ' (click to copy)'"
              @click="copy(t.user_id)"
            >{{ shortId(t.user_id) }}</code>
          </div>
          <div class="text-sm font-semibold text-right">{{ t.messages_total }}</div>
          <div class="text-xs text-right flex flex-col">
            <span><strong class="text-emerald-600">{{ t.messages_sent }}</strong> sent</span>
            <span v-if="t.messages_failed || t.messages_bounced" class="text-[var(--app-muted)]">
              <strong class="text-amber-600">{{ t.messages_failed }}</strong> fail ·
              <strong class="text-rose-500">{{ t.messages_bounced }}</strong> bnc
            </span>
            <span v-else-if="t.messages_queued" class="text-sky-600">{{ t.messages_queued }} queued</span>
            <span v-else class="text-[var(--app-muted)]">—</span>
          </div>
          <div class="text-sm text-right">{{ t.domains }}</div>
          <div class="text-sm text-right">{{ t.keys }}</div>
          <div class="text-xs text-right text-[var(--app-muted)]">{{ fmtDateTime(t.last_send_at) }}</div>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:users" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">
        {{ search ? 'No tenants match your filter' : 'No one has enrolled in delivery yet' }}
      </div>
    </div>
  </section>
</template>
