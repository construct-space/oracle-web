<script setup lang="ts">
import { Pagination } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { type AdminDomain, type ListDomainsParams, listDomains } from './api'

const domains = ref<AdminDomain[]>([])
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
  const params: ListDomainsParams = { page: page.value, limit: pageSize.value }
  if (search.value.trim()) params.search = search.value.trim()
  if (statusFilter.value) params.status = statusFilter.value
  try {
    const res = await listDomains(params)
    if (mySeq !== reqSeq) return
    domains.value = res.data ?? []
    total.value = res.total ?? 0
  } catch (err) {
    if (mySeq !== reqSeq) return
    error.value = err instanceof Error ? err.message : 'Failed to load domains'
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

function statusPill(s: string): string {
  if (s === 'active') return 'bg-emerald-500/15 text-emerald-600'
  if (s === 'pending') return 'bg-amber-500/15 text-amber-600'
  return 'bg-rose-500/15 text-rose-500'
}

function shortUUID(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}

function fmtDate(s: string): string {
  if (!s) return '—'
  const t = new Date(s)
  if (isNaN(t.getTime())) return s
  return t.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Domains</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">Every registered domain across all tenants.</p>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search by domain or user UUID…"
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
        <option value="active">Active</option>
        <option value="pending">Pending</option>
        <option value="expired">Expired</option>
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

    <div v-if="loading && !domains.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="domains.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <RouterLink
        v-for="d in domains"
        :key="d.id"
        :to="`/domains/list/${d.domain}`"
        class="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--app-card-hover)]"
      >
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:globe-2" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-mono truncate">{{ d.domain }}</div>
          <div class="text-xs text-[var(--app-muted)] mt-0.5">
            <code>{{ shortUUID(d.user_uuid) }}</code> · expires {{ fmtDate(d.expire_date) }}
          </div>
        </div>
        <span
          v-if="d.auto_renew"
          class="text-[10px] uppercase tracking-wider text-emerald-600 border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0"
        >Auto</span>
        <span class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0" :class="statusPill(d.status)">
          {{ d.status }}
        </span>
      </RouterLink>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-if="!loading && !total" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:globe-2" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No domains match your filters</div>
    </div>
  </section>
</template>
