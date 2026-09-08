<script setup lang="ts">
import { Pagination } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { type AccountSession, listSessions } from './api'

const loading = ref(false)
const error = ref('')
const sessions = ref<AccountSession[]>([])
const search = ref('')
const page = ref(1)
const pageSize = ref(10)

async function load() {
  loading.value = true
  error.value = ''
  try {
    sessions.value = (await listSessions({ active_only: true })).data
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load sessions'
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return sessions.value
  return sessions.value.filter(
    (s) =>
      String(s.user_id).includes(q) ||
      (s.user_agent || '').toLowerCase().includes(q) ||
      (s.ip_address || '').toLowerCase().includes(q),
  )
})

const paginated = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

const rangeLabel = computed(() => {
  const total = filtered.value.length
  if (!total) return '0'
  const start = (page.value - 1) * pageSize.value + 1
  const end = Math.min(start + pageSize.value - 1, total)
  return `${start}–${end} of ${total}`
})

watch(
  () => filtered.value.length,
  () => {
    page.value = 1
  },
)

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Sessions</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">Active sessions across all Construct accounts.</p>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search by user, device, or IP…"
        class="w-full bg-transparent text-sm text-[var(--app-foreground)] outline-none placeholder:text-[var(--app-muted)]"
        aria-label="Filter sessions"
      />
    </div>

    <div v-if="filtered.length > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="filtered.length" :page-count="pageSize" />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !sessions.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="paginated.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <RouterLink
        v-for="session in paginated"
        :key="session.id"
        :to="`/accounts/users/${session.user_id}`"
        class="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--app-card-hover)]"
      >
        <div class="size-9 rounded-full grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] text-xs font-semibold shrink-0">
          #{{ session.id }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ session.user_agent || 'Unknown device' }}</div>
          <div class="text-xs text-[var(--app-muted)] truncate">User {{ session.user_id }} · {{ session.ip_address || '—' }}</div>
        </div>
        <span class="text-xs text-[var(--app-muted)] w-40 shrink-0 hidden md:inline text-right">
          expires {{ fmtDateTime(session.expires_at) }}
        </span>
      </RouterLink>
    </div>

    <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:key-round" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No active sessions</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Sessions will appear here as users sign in.
      </p>
    </div>

    <div v-if="filtered.length > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="filtered.length" :page-count="pageSize" />
    </div>
  </section>
</template>
