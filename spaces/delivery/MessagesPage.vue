<script setup lang="ts">
import { Pagination } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { type DeliveryMessage, type ListMessagesParams, listMessages } from './api'

const messages = ref<DeliveryMessage[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const search = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = ref(10)

let searchTimer: ReturnType<typeof setTimeout> | null = null
let reqSeq = 0

async function load() {
  const mySeq = ++reqSeq
  loading.value = true
  error.value = ''
  const params: ListMessagesParams = { page: page.value, limit: pageSize.value }
  if (search.value.trim()) params.search = search.value.trim()
  if (statusFilter.value) params.status = statusFilter.value
  try {
    const res = await listMessages(params)
    if (mySeq !== reqSeq) return // stale (user typed faster than network)
    // Accept either envelope — paginated {data,total} from the new delivery-api
    // build or the legacy {messages} shape still running in prod during a rollout.
    // Remove the fallback once every env is on the paginated build.
    const legacy = (res as unknown as { messages?: DeliveryMessage[] }).messages
    messages.value = res.data ?? legacy ?? []
    total.value = res.total ?? legacy?.length ?? 0
  } catch (err) {
    if (mySeq !== reqSeq) return
    error.value = err instanceof Error ? err.message : 'Failed to load messages'
  } finally {
    if (mySeq === reqSeq) loading.value = false
  }
}

const rangeLabel = computed(() => {
  if (!total.value) return '0'
  const start = (page.value - 1) * pageSize.value + 1
  const end = Math.min(start + pageSize.value - 1, total.value)
  return `${start}–${end} of ${total.value}`
})

// Filters reset to page 1; search debounced.
watch(search, () => {
  page.value = 1
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 300)
})
watch(statusFilter, () => {
  page.value = 1
  load()
})
watch(page, load)

function statusPill(status: string): string {
  switch (status) {
    case 'sent':
      return 'bg-emerald-500/15 text-emerald-600'
    case 'queued':
    case 'sending':
      return 'bg-sky-500/15 text-sky-600'
    case 'failed':
      return 'bg-amber-500/15 text-amber-600'
    case 'bounced':
      return 'bg-rose-500/15 text-rose-500'
    default:
      return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
  }
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Messages</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">Outbound mail across every tenant.</p>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search by recipient or subject…"
        class="w-full bg-transparent text-sm outline-none placeholder:text-[var(--app-muted)]"
      />
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <select
        v-model="statusFilter"
        class="text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2.5 py-1.5 text-[var(--app-foreground)]"
        aria-label="Status filter"
      >
        <option value="">All statuses</option>
        <option value="sent">Sent</option>
        <option value="queued">Queued</option>
        <option value="sending">Sending</option>
        <option value="failed">Failed</option>
        <option value="bounced">Bounced</option>
      </select>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !messages.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="messages.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <div v-for="msg in messages" :key="msg.id" class="flex items-center gap-4 px-5 py-3">
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:mail" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ msg.subject || '(no subject)' }}</div>
          <div class="text-xs text-[var(--app-muted)] truncate">
            {{ msg.to_email }} · from {{ msg.from_email }}
          </div>
        </div>
        <span class="text-xs text-[var(--app-muted)] w-36 shrink-0 hidden md:inline text-right">
          {{ fmtDateTime(msg.sent_at || msg.created_at) }}
        </span>
        <span class="inline-flex text-xs font-medium px-2 py-0.5 rounded shrink-0" :class="statusPill(msg.status)">
          {{ msg.status }}
        </span>
      </div>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-if="!loading && !total" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:send" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No messages match your filters</div>
    </div>
  </section>
</template>
