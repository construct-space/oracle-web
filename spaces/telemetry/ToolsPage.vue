<script setup lang="ts">
import { Pagination } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { type DailyToolUsage, listTools } from './api'

const rows = ref<DailyToolUsage[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const userFilter = ref('')
const toolFilter = ref('')
const page = ref(1)
const pageSize = ref(25)

let t: ReturnType<typeof setTimeout> | null = null
let seq = 0

async function load() {
  const mine = ++seq
  loading.value = true
  error.value = ''
  try {
    const res = await listTools({
      page: page.value,
      limit: pageSize.value,
      user_id: userFilter.value.trim(),
      tool_name: toolFilter.value.trim(),
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

watch([userFilter, toolFilter], () => {
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
function successRate(r: DailyToolUsage): number {
  if (!r.invocations) return 0
  return Math.round((r.success_count / r.invocations) * 100)
}
function avgMs(r: DailyToolUsage): number {
  if (!r.invocations) return 0
  return Math.round(r.total_ms / r.invocations)
}
onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Tools</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Builtin-tool invocations per day with success/error split and mean latency.
      </p>
    </div>

    <div class="flex gap-2">
      <input v-model="userFilter" placeholder="Filter user id…" class="flex-1 rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-1.5 text-sm outline-none" />
      <input v-model="toolFilter" placeholder="Tool name (e.g. read, grep)…" class="flex-1 rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-1.5 text-sm outline-none" />
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
            <th class="px-4 py-2 text-left">TOOL</th>
            <th class="px-4 py-2 text-right">CALLS</th>
            <th class="px-4 py-2 text-right">OK</th>
            <th class="px-4 py-2 text-right">FAIL</th>
            <th class="px-4 py-2 text-right">SUCCESS</th>
            <th class="px-4 py-2 text-right">AVG</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--app-border)]">
          <tr v-for="r in rows" :key="r.id">
            <td class="px-4 py-2 font-mono text-xs">{{ r.date }}</td>
            <td class="px-4 py-2">{{ r.user_id }}</td>
            <td class="px-4 py-2 font-mono">{{ r.tool_name }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(r.invocations) }}</td>
            <td class="px-4 py-2 text-right tabular-nums text-emerald-600">{{ fmt(r.success_count) }}</td>
            <td class="px-4 py-2 text-right tabular-nums" :class="r.error_count > 0 ? 'text-rose-500' : 'text-[var(--app-muted)]'">{{ fmt(r.error_count) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ successRate(r) }}%</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(avgMs(r)) }}ms</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">{{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-if="!loading && !total" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center text-sm text-[var(--app-muted)]">
      No tool usage yet.
    </div>
  </section>
</template>
