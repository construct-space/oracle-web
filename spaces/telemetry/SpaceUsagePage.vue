<script setup lang="ts">
import { Pagination } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { type DailySpaceUsage, getTopSpaces, listSpaceUsage, type TopSpace } from './api'

const rows = ref<DailySpaceUsage[]>([])
const tops = ref<TopSpace[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const userFilter = ref('')
const spaceFilter = ref('')
const page = ref(1)
const pageSize = ref(25)

let t: ReturnType<typeof setTimeout> | null = null
let seq = 0

async function load() {
  const mine = ++seq
  loading.value = true
  error.value = ''
  try {
    const [res, top] = await Promise.all([
      listSpaceUsage({
        page: page.value,
        limit: pageSize.value,
        user_id: userFilter.value.trim(),
        space_id: spaceFilter.value.trim(),
      }),
      page.value === 1 && !userFilter.value && !spaceFilter.value
        ? getTopSpaces(7, 5)
        : Promise.resolve({ data: [] as TopSpace[], window_days: 7 }),
    ])
    if (mine !== seq) return
    rows.value = res.data ?? []
    total.value = res.total ?? 0
    tops.value = top.data ?? []
  } catch (e) {
    if (mine !== seq) return
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (mine === seq) loading.value = false
  }
}

watch([userFilter, spaceFilter], () => {
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
onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Space usage</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">Which spaces tenants touch — most active first.</p>
    </div>

    <!-- Top-5 strip -->
    <div v-if="tops.length" class="grid gap-3 md:grid-cols-5">
      <div v-for="t in tops" :key="t.space_id" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
        <div class="text-sm font-semibold truncate">{{ t.space_id }}</div>
        <div class="text-xs text-[var(--app-muted)]">{{ fmt(t.active_minutes) }} min · {{ t.unique_users }} users</div>
      </div>
    </div>

    <div class="flex gap-2">
      <input v-model="userFilter" placeholder="Filter by user id…" class="flex-1 rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-1.5 text-sm outline-none" />
      <input v-model="spaceFilter" placeholder="Filter by space…" class="flex-1 rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-1.5 text-sm outline-none" />
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
            <th class="px-4 py-2 text-left">SPACE</th>
            <th class="px-4 py-2 text-right">ENTERS</th>
            <th class="px-4 py-2 text-right">ACTIVE MIN</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--app-border)]">
          <tr v-for="r in rows" :key="r.id">
            <td class="px-4 py-2 font-mono text-xs">{{ r.date }}</td>
            <td class="px-4 py-2">{{ r.user_id }}</td>
            <td class="px-4 py-2 font-mono">{{ r.space_id }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(r.enter_count) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(r.active_minutes) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">{{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-if="!loading && !total" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center text-sm text-[var(--app-muted)]">
      No space usage yet.
    </div>
  </section>
</template>
