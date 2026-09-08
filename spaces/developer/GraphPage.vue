<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  getGraphStats,
  type GraphSchemaRow,
  type GraphStats,
  listGraphSchemas,
} from './api'

const stats = ref<GraphStats | null>(null)
const schemas = ref<GraphSchemaRow[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [s, list] = await Promise.all([getGraphStats(), listGraphSchemas()])
    stats.value = s
    schemas.value = list.schemas || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load graph admin data'
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return schemas.value
  return schemas.value.filter(
    (s) =>
      s.space_id.toLowerCase().includes(q) ||
      s.schema_name.toLowerCase().includes(q) ||
      (s.project_id || '').toLowerCase().includes(q),
  )
})

function fmtNumber(n: number | undefined): string {
  if (n === undefined || n === null) return '—'
  return n.toLocaleString()
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const cards = computed(() => [
  { label: 'Schemas', value: fmtNumber(stats.value?.schemas), icon: 'lucide:layers' },
  { label: 'Tables',  value: fmtNumber(stats.value?.tables),  icon: 'lucide:table' },
  { label: 'Rows',    value: fmtNumber(stats.value?.rows),    icon: 'lucide:rows-3' },
  { label: 'DB size', value: stats.value?.size ?? '—',        icon: 'lucide:hard-drive' },
])

onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">Graph</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Runtime registry shared by every published space. Stats are live; schemas are
          provisioned per space + project.
        </p>
      </div>
      <button
        type="button"
        class="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)] disabled:opacity-50"
        :disabled="loading"
        @click="load"
      >
        <Icon icon="lucide:refresh-cw" class="size-3.5 inline mr-1" :class="loading ? 'animate-spin' : ''" />
        Refresh
      </button>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div
        v-for="c in cards"
        :key="c.label"
        class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3 flex flex-col gap-1"
      >
        <div class="flex items-center gap-2 text-[var(--app-muted)]">
          <Icon :icon="c.icon" class="size-3.5" />
          <span class="text-xs uppercase tracking-wider">{{ c.label }}</span>
        </div>
        <div class="text-xl font-semibold tabular-nums">{{ c.value }}</div>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-medium">Provisioned schemas</h2>
        <span class="text-xs text-[var(--app-muted)] tabular-nums">
          {{ filtered.length }} of {{ schemas.length }}
        </span>
      </div>

      <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-2">
        <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
        <input
          v-model="search"
          type="text"
          placeholder="Filter by space, schema, or project…"
          class="w-full bg-transparent text-sm text-[var(--app-foreground)] outline-none placeholder:text-[var(--app-muted)]"
          aria-label="Filter schemas"
        />
      </div>

      <div v-if="loading && !schemas.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

      <div
        v-else-if="filtered.length"
        class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
      >
        <RouterLink
          v-for="row in filtered"
          :key="row.schema_name"
          :to="`/developer/graph/${encodeURIComponent(row.schema_name)}`"
          class="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-[var(--app-card-hover)]"
        >
          <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
            <Icon icon="lucide:database" class="size-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate font-mono">{{ row.space_id }}</div>
            <div class="text-xs text-[var(--app-muted)] truncate font-mono">
              {{ row.schema_name }}<span v-if="row.project_id"> · project {{ row.project_id }}</span>
            </div>
          </div>
          <span class="text-xs text-[var(--app-muted)] w-20 shrink-0 hidden md:inline text-right tabular-nums">
            v{{ row.manifest_version || '?' }}
          </span>
          <span class="text-xs text-[var(--app-muted)] w-32 shrink-0 hidden md:inline text-right">
            {{ fmtDate(row.provisioned_at) }}
          </span>
        </RouterLink>
      </div>

      <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
        <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
          <Icon icon="lucide:database" class="size-6" />
        </div>
        <div class="text-sm font-medium mt-3">No schemas</div>
        <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
          Either nothing has been provisioned yet, or your filter excluded every row.
        </p>
      </div>
    </div>
  </section>
</template>
