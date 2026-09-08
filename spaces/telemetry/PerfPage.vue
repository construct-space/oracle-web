<script setup lang="ts">
import { Pagination } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { type DailyPerf, listPerf } from './api'

const rows = ref<DailyPerf[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const userFilter = ref('')
const metricFilter = ref('')
const page = ref(1)
const pageSize = ref(25)

let t: ReturnType<typeof setTimeout> | null = null
let seq = 0

async function load() {
  const mine = ++seq
  loading.value = true
  error.value = ''
  try {
    const res = await listPerf({
      page: page.value,
      limit: pageSize.value,
      user_id: userFilter.value.trim(),
      metric: metricFilter.value.trim(),
    })
    if (mine !== seq) return
    rows.value = res.data ?? []
    total.value = res.total ?? 0
  } catch (e) {
    if (mine !== seq) return
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (mine === seq) loading.value = false
  }
}

watch([userFilter, metricFilter], () => {
  page.value = 1
  if (t) clearTimeout(t)
  t = setTimeout(load, 300)
})
watch(page, load)

const rangeLabel = computed(() => {
  if (!total.value) return '0'
  const s = (page.value - 1) * pageSize.value + 1
  return `${s}–${Math.min(s + pageSize.value - 1, total.value)} of ${total.value}`
})

function fmt(n: number): string {
  return (n ?? 0).toLocaleString()
}
function avgMs(total_ms: number, count: number): number {
  if (!count) return 0
  return Math.round(total_ms / count)
}

onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Performance</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Latency per metric. Avg = total ÷ count; exact percentiles require per-sample data we don't ship.
      </p>
    </div>

    <div class="flex gap-2">
      <input v-model="userFilter" placeholder="Filter user id…" class="flex-1 rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-1.5 text-sm outline-none" />
      <input v-model="metricFilter" placeholder="Metric name (e.g. ai.first_token_ms)…" class="flex-1 rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-1.5 text-sm outline-none" />
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">{{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-if="error" class="text-sm text-rose-500"><Icon icon="lucide:alert-circle" class="size-4 inline mr-1" />{{ error }}</div>
    <div v-if="loading && !rows.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div v-else-if="rows.length" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-[11px] tracking-wider text-[var(--app-muted)] border-b border-[var(--app-border)]">
          <tr>
            <th class="px-4 py-2 text-left">DATE</th>
            <th class="px-4 py-2 text-left">USER</th>
            <th class="px-4 py-2 text-left">METRIC</th>
            <th class="px-4 py-2 text-right">COUNT</th>
            <th class="px-4 py-2 text-right">MIN</th>
            <th class="px-4 py-2 text-right">AVG</th>
            <th class="px-4 py-2 text-right">MAX</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--app-border)]">
          <tr v-for="r in rows" :key="r.id">
            <td class="px-4 py-2 font-mono text-xs">{{ r.date }}</td>
            <td class="px-4 py-2">{{ r.user_id }}</td>
            <td class="px-4 py-2 font-mono text-xs">{{ r.metric }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(r.count) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(r.min_ms) }}ms</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(avgMs(r.total_ms, r.count)) }}ms</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(r.max_ms) }}ms</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">{{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-if="!loading && !total" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center text-sm text-[var(--app-muted)]">
      No perf data yet.
    </div>
  </section>
</template>
