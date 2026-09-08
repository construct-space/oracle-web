<script setup lang="ts">
import WorldMap from '@/components/WorldMap.vue'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { type GeoRow, type GeoUserRow, getGeo, getGeoUsers } from './api'

const rows = ref<GeoRow[]>([])
const loading = ref(false)
const error = ref('')
const days = ref(7)

const selected = ref<string>('')
const selectedRows = ref<GeoUserRow[]>([])
const drillLoading = ref(false)
const drillError = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await getGeo(days.value)
    rows.value = res.data ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function loadDrill(cc: string) {
  if (!cc) {
    selectedRows.value = []
    return
  }
  drillLoading.value = true
  drillError.value = ''
  try {
    const res = await getGeoUsers(cc, days.value)
    selectedRows.value = res.data ?? []
  } catch (e) {
    drillError.value = e instanceof Error ? e.message : String(e)
    selectedRows.value = []
  } finally {
    drillLoading.value = false
  }
}

function selectCountry(cc: string) {
  selected.value = cc
  void loadDrill(cc)
}

function clearSelection() {
  selected.value = ''
  selectedRows.value = []
}

watch(days, () => {
  load()
  // Drill-down is window-dependent — refresh it too so the user list
  // tracks the new window without a stale snapshot.
  if (selected.value) loadDrill(selected.value)
})
onMounted(load)

const totalActiveUsers = computed(() =>
  rows.value.reduce((acc, r) => acc + r.active_users, 0),
)

function pct(n: number): number {
  if (!totalActiveUsers.value) return 0
  return (n / totalActiveUsers.value) * 100
}

// Map prop input — single source for both the table and the choropleth so
// they stay in sync no matter which one the user is reading from.
const mapData = computed(() =>
  rows.value.map(r => ({ country_code: r.country_code, value: r.active_users })),
)

function flag(cc: string): string {
  if (!cc || cc.length !== 2) return ''
  const a = cc.toUpperCase().charCodeAt(0)
  const b = cc.toUpperCase().charCodeAt(1)
  if (a < 65 || a > 90 || b < 65 || b > 90) return ''
  return String.fromCodePoint(0x1f1e6 + (a - 65), 0x1f1e6 + (b - 65))
}

function fmt(n: number): string {
  return (n ?? 0).toLocaleString()
}
</script>

<template>
  <section class="max-w-6xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Geo</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Active users by country, derived from the IP we observed at sync time.
        Click a country to drill into the users active there.
      </p>
    </div>

    <div class="flex items-center gap-2">
      <label class="text-xs text-[var(--app-muted)]">Window</label>
      <select v-model.number="days" class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-1.5 text-sm">
        <option :value="1">Last 24h</option>
        <option :value="7">Last 7 days</option>
        <option :value="30">Last 30 days</option>
        <option :value="90">Last 90 days</option>
      </select>
      <span v-if="selected" class="text-xs text-[var(--app-muted)] ml-3">
        Drilled into <strong class="text-[var(--app-text)]">{{ flag(selected) }} {{ selected }}</strong>
      </span>
      <button
        v-if="selected"
        class="ml-1 text-xs text-blue-500 hover:underline"
        @click="clearSelection"
      >
        clear
      </button>
    </div>

    <div v-if="error" class="text-sm text-rose-500">
      <Icon icon="lucide:alert-circle" class="size-4 inline mr-1" />{{ error }}
    </div>

    <WorldMap :data="mapData" :selected="selected" @select="selectCountry" />

    <!-- Drill-down panel — only renders once a country is picked. -->
    <div v-if="selected" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] overflow-hidden">
      <div class="px-5 py-3 border-b border-[var(--app-border)] flex items-center justify-between">
        <div>
          <div class="font-medium">{{ flag(selected) }} {{ selected }} — users in window</div>
          <div class="text-xs text-[var(--app-muted)]">{{ selectedRows.length }} active over the last {{ days }} day{{ days === 1 ? '' : 's' }}</div>
        </div>
        <button class="text-xs text-[var(--app-muted)] hover:text-[var(--app-text)]" @click="clearSelection">
          <Icon icon="lucide:x" class="size-4 inline" />
        </button>
      </div>
      <div v-if="drillError" class="p-4 text-sm text-rose-500">{{ drillError }}</div>
      <div v-else-if="drillLoading" class="p-4 text-sm text-[var(--app-muted)]">Loading…</div>
      <table v-else-if="selectedRows.length" class="w-full text-sm">
        <thead class="text-[11px] tracking-wider text-[var(--app-muted)] border-b border-[var(--app-border)]">
          <tr>
            <th class="px-4 py-2 text-left">USER</th>
            <th class="px-4 py-2 text-right">SESSIONS</th>
            <th class="px-4 py-2 text-right">MIN</th>
            <th class="px-4 py-2 text-right">TOKENS</th>
            <th class="px-4 py-2 text-right">ERR</th>
            <th class="px-4 py-2 text-left">LAST</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--app-border)]">
          <tr v-for="u in selectedRows" :key="u.user_id">
            <td class="px-4 py-2">#{{ u.user_id }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(u.sessions) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(u.active_minutes) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(u.tokens_total) }}</td>
            <td class="px-4 py-2 text-right tabular-nums" :class="u.errors > 0 ? 'text-rose-500 font-semibold' : ''">{{ fmt(u.errors) }}</td>
            <td class="px-4 py-2 font-mono text-xs">{{ u.last_active }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="p-6 text-center text-sm text-[var(--app-muted)]">
        No users in {{ selected }} this window.
      </div>
    </div>

    <!-- Country ranking table stays — it's a dense listing the map can't replace. -->
    <div v-if="loading && !rows.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div v-else-if="rows.length" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] overflow-hidden">
      <table class="w-full text-sm">
        <thead class="text-[11px] tracking-wider text-[var(--app-muted)] border-b border-[var(--app-border)]">
          <tr>
            <th class="px-4 py-2 text-left">COUNTRY</th>
            <th class="px-4 py-2 text-right">USERS</th>
            <th class="px-4 py-2 text-right">SESSIONS</th>
            <th class="px-4 py-2 text-right">MIN</th>
            <th class="px-4 py-2 text-left w-1/3">SHARE</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--app-border)]">
          <tr
            v-for="r in rows"
            :key="r.country_code"
            class="cursor-pointer hover:bg-white/5"
            :class="r.country_code === selected ? 'bg-amber-500/10' : ''"
            @click="selectCountry(r.country_code)"
          >
            <td class="px-4 py-2"><span class="text-base mr-1">{{ flag(r.country_code) }}</span>{{ r.country_code }}</td>
            <td class="px-4 py-2 text-right tabular-nums font-medium">{{ fmt(r.active_users) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(r.sessions) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmt(r.active_minutes) }}</td>
            <td class="px-4 py-2">
              <div class="h-2 rounded-full bg-[var(--app-border)] overflow-hidden">
                <div class="h-full bg-blue-500" :style="{ width: pct(r.active_users) + '%' }" />
              </div>
              <span class="text-[11px] text-[var(--app-muted)] tabular-nums">{{ pct(r.active_users).toFixed(1) }}%</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!loading && !rows.length" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center text-sm text-[var(--app-muted)]">
      No country data yet. Country gets stamped on the next ingest from any
      public IP — once the desktop app starts syncing, rows will land here.
    </div>
  </section>
</template>
