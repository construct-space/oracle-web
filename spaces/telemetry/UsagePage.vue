<script setup lang="ts">
import { Pagination } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { type DailyUsage, listUsage } from './api'

const rows = ref<DailyUsage[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const userFilter = ref('')
const dateFilter = ref('')
const page = ref(1)
const pageSize = ref(25)

let t: ReturnType<typeof setTimeout> | null = null
let seq = 0

async function load() {
  const mine = ++seq
  loading.value = true
  error.value = ''
  try {
    const res = await listUsage({
      page: page.value,
      limit: pageSize.value,
      user_id: userFilter.value.trim(),
      date: dateFilter.value.trim(),
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

watch([userFilter, dateFilter], () => {
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

// Two-letter ISO country code → flag emoji via regional indicator codepoints.
// 'A' starts at U+1F1E6, so each letter maps to its own combining glyph.
function flag(cc: string): string {
  if (!cc || cc.length !== 2) return ''
  const a = cc.toUpperCase().charCodeAt(0)
  const b = cc.toUpperCase().charCodeAt(1)
  if (a < 65 || a > 90 || b < 65 || b > 90) return ''
  return String.fromCodePoint(0x1f1e6 + (a - 65), 0x1f1e6 + (b - 65))
}
onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Usage</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">Per-user, per-day activity rollup.</p>
    </div>

    <div class="flex gap-2">
      <input v-model="userFilter" placeholder="Filter by user id…" class="flex-1 rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-1.5 text-sm outline-none" />
      <input v-model="dateFilter" placeholder="YYYY-MM-DD" class="w-40 rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-1.5 text-sm outline-none font-mono" />
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
            <th class="px-4 py-2 text-left">CC</th>
            <th class="px-4 py-2 text-right">SESSIONS</th>
            <th class="px-4 py-2 text-right">MIN</th>
            <th class="px-4 py-2 text-right">CHATS</th>
            <th class="px-4 py-2 text-right">TOOLS</th>
            <th class="px-4 py-2 text-right">IN</th>
            <th class="px-4 py-2 text-right">OUT</th>
            <th class="px-4 py-2 text-right">ERR</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--app-border)]">
          <tr v-for="r in rows" :key="r.id">
            <td class="px-4 py-2 font-mono text-xs">{{ r.date }}</td>
            <td class="px-4 py-2">{{ r.user_id }}</td>
            <td class="px-4 py-2"><span :title="r.country_code">{{ flag(r.country_code) }} {{ r.country_code || '—' }}</span></td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(r.sessions) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(r.active_minutes) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(r.chats_sent) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(r.tool_calls) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(r.tokens_input) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(r.tokens_output) }}</td>
            <td class="px-4 py-2 text-right tabular-nums" :class="r.errors > 0 ? 'text-rose-500 font-semibold' : ''">{{ fmt(r.errors) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">{{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-if="!loading && !total" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center text-sm text-[var(--app-muted)]">
      No usage data yet. The desktop app posts hourly — check back soon.
    </div>
  </section>
</template>
