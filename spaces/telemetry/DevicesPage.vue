<script setup lang="ts">
import { Pagination } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { listDevices, type UserDevice } from './api'

const rows = ref<UserDevice[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const userFilter = ref('')
const osFilter = ref('')
const page = ref(1)
const pageSize = ref(25)

let t: ReturnType<typeof setTimeout> | null = null
let seq = 0

async function load() {
  const mine = ++seq
  loading.value = true
  error.value = ''
  try {
    const res = await listDevices({
      page: page.value,
      limit: pageSize.value,
      user_id: userFilter.value.trim(),
      os_type: osFilter.value,
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

watch([userFilter, osFilter], () => {
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

function fmtDateTime(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function osIcon(os: string): string {
  const o = (os || '').toLowerCase()
  if (o.includes('mac') || o === 'darwin') return 'lucide:apple'
  if (o.includes('win')) return 'simple-icons:windows'
  if (o.includes('linux')) return 'simple-icons:linux'
  return 'lucide:monitor'
}

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
      <h1 class="text-xl font-semibold">Devices</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">Per-user device snapshots. Updated on app boot + after updates.</p>
    </div>

    <div class="flex gap-2">
      <input v-model="userFilter" placeholder="Filter by user id…" class="flex-1 rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-1.5 text-sm outline-none" />
      <select v-model="osFilter" class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-1.5 text-sm">
        <option value="">All OS</option>
        <option value="darwin">macOS</option>
        <option value="windows">Windows</option>
        <option value="linux">Linux</option>
      </select>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">{{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-if="error" class="text-sm text-rose-500"><Icon icon="lucide:alert-circle" class="size-4 inline mr-1" />{{ error }}</div>
    <div v-if="loading && !rows.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div v-else-if="rows.length" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]">
      <div v-for="d in rows" :key="d.id" class="flex items-center gap-4 px-5 py-3">
        <Icon :icon="osIcon(d.os_type)" class="size-5 text-[var(--app-muted)] shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium">
            {{ d.os_type || '?' }} · v{{ d.app_version || '?' }}
            <span class="text-[var(--app-muted)] font-normal ml-2">{{ d.os_platform }} {{ d.os_arch }} {{ d.os_version }}</span>
          </div>
          <div class="text-xs text-[var(--app-muted)]">
            user #{{ d.user_id }}
            <span v-if="d.country_code" :title="d.country_code" class="ml-1">· {{ flag(d.country_code) }} {{ d.country_code }}</span>
            · first seen {{ fmtDateTime(d.first_seen_at) }}
          </div>
        </div>
        <span class="text-xs text-[var(--app-muted)] shrink-0">Last {{ fmtDateTime(d.last_seen_at) }}</span>
      </div>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">{{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-if="!loading && !total" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center text-sm text-[var(--app-muted)]">
      No devices yet.
    </div>
  </section>
</template>
