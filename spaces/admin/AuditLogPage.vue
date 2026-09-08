<script setup lang="ts">
import { Pagination } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { type AuditLogEntry, type ListAuditLogParams, listAuditLog } from './api'

const entries = ref<AuditLogEntry[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const page = ref(1)
const pageSize = ref(20)

const actionFilter = ref('')
const resourceTypeFilter = ref('')
const actorIdFilter = ref<string>('')

let reqSeq = 0

async function load() {
  const mySeq = ++reqSeq
  loading.value = true
  error.value = ''
  const params: ListAuditLogParams = { page: page.value, limit: pageSize.value }
  if (actionFilter.value) params.action = actionFilter.value
  if (resourceTypeFilter.value) params.resource_type = resourceTypeFilter.value
  if (actorIdFilter.value.trim()) {
    const n = Number(actorIdFilter.value)
    if (Number.isFinite(n) && n > 0) params.actor_id = n
  }
  try {
    const res = await listAuditLog(params)
    if (mySeq !== reqSeq) return
    entries.value = res.entries
    total.value = res.total
  } catch (err) {
    if (mySeq !== reqSeq) return
    error.value = err instanceof Error ? err.message : String(err)
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

watch([actionFilter, resourceTypeFilter, actorIdFilter], () => {
  page.value = 1
  load()
})
watch(page, load)

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function actionBadge(action: string): string {
  if (action.endsWith('.delete') || action.endsWith('.revoke')) return 'bg-rose-500/15 text-rose-500'
  if (action.endsWith('.approve') || action.endsWith('.verify')) return 'bg-emerald-500/15 text-emerald-600'
  if (action.endsWith('.reject') || action.endsWith('.unpublish') || action.endsWith('.suspend'))
    return 'bg-amber-500/15 text-amber-600'
  if (action.endsWith('.create')) return 'bg-sky-500/15 text-sky-600'
  return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
}

function parseMetadata(meta: string | null): Record<string, unknown> | null {
  if (!meta) return null
  try {
    return JSON.parse(meta) as Record<string, unknown>
  } catch {
    return null
  }
}

const expandedId = ref<number | null>(null)
function toggleExpand(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Audit log</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Every privileged action taken through Oracle. Entries are written on successful mutations only.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <input
        v-model="actionFilter"
        type="text"
        placeholder="Action (e.g. space.approve)"
        class="text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2.5 py-1.5 text-[var(--app-foreground)] flex-1 min-w-[10rem] outline-none focus:border-[var(--app-accent)]"
      />
      <input
        v-model="resourceTypeFilter"
        type="text"
        placeholder="Resource (e.g. user, space)"
        class="text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2.5 py-1.5 text-[var(--app-foreground)] flex-1 min-w-[10rem] outline-none focus:border-[var(--app-accent)]"
      />
      <input
        v-model="actorIdFilter"
        type="number"
        placeholder="Actor admin ID"
        class="text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2.5 py-1.5 text-[var(--app-foreground)] w-32 outline-none focus:border-[var(--app-accent)]"
      />
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !entries.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="entries.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="px-5 py-3 cursor-pointer transition-colors hover:bg-[var(--app-card-hover)]"
        @click="toggleExpand(entry.id)"
      >
        <div class="flex items-center gap-4">
          <span class="inline-flex text-xs font-medium px-2 py-0.5 rounded shrink-0 font-mono" :class="actionBadge(entry.action)">
            {{ entry.action }}
          </span>
          <div class="flex-1 min-w-0">
            <div class="text-xs text-[var(--app-muted)] truncate">
              <span v-if="entry.resource_type" class="font-mono">{{ entry.resource_type }}<span v-if="entry.resource_id">:{{ entry.resource_id }}</span></span>
              <span v-else class="italic">—</span>
              <span class="mx-2">·</span>
              <span>by {{ entry.actor_email || `admin #${entry.actor_administrator_id ?? '?'}` }}</span>
              <span class="mx-2">·</span>
              <span>{{ entry.ip_address }}</span>
            </div>
          </div>
          <span class="text-xs text-[var(--app-muted)] shrink-0">{{ fmtDateTime(entry.created_at) }}</span>
          <Icon
            :icon="expandedId === entry.id ? 'lucide:chevron-up' : 'lucide:chevron-down'"
            class="size-3.5 text-[var(--app-muted)] shrink-0"
          />
        </div>

        <div v-if="expandedId === entry.id" class="mt-3 pt-3 border-t border-[var(--app-border)] text-xs space-y-1">
          <div><span class="text-[var(--app-muted)]">User agent:</span> {{ entry.user_agent || '—' }}</div>
          <div v-if="parseMetadata(entry.metadata)">
            <div class="text-[var(--app-muted)] mb-1">Metadata:</div>
            <pre class="rounded bg-[var(--app-surface)] px-2 py-1.5 overflow-x-auto">{{ JSON.stringify(parseMetadata(entry.metadata), null, 2) }}</pre>
          </div>
          <div v-else-if="entry.metadata">
            <div class="text-[var(--app-muted)] mb-1">Metadata:</div>
            <pre class="rounded bg-[var(--app-surface)] px-2 py-1.5 overflow-x-auto">{{ entry.metadata }}</pre>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:scroll-text" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No audit entries match your filters</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Entries accumulate as staff run privileged actions.
      </p>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>
  </section>
</template>
