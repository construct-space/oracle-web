<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { getSummary, getTrends, type Summary, type TrendPoint } from './api'

const window = ref(7)
const summary = ref<Summary | null>(null)
const trends = ref<TrendPoint[]>([])
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [s, t] = await Promise.all([getSummary(window.value), getTrends(Math.max(window.value, 14))])
    summary.value = s
    trends.value = t.data ?? []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load summary'
  } finally {
    loading.value = false
  }
}

watch(window, load)
onMounted(load)

const activeDelta = computed(() => {
  if (!summary.value) return 0
  return summary.value.active_today - summary.value.active_yesterday
})

function fmt(n: number): string {
  return (n ?? 0).toLocaleString()
}

function fmtUSD(n: number): string {
  if (!n) return '$0.00'
  if (n < 1) return `$${n.toFixed(3)}`
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Tiny SVG sparkline — no chart library, just points mapped onto a viewBox.
function sparkPath(points: number[]): string {
  if (!points.length) return ''
  const max = Math.max(...points, 1)
  const step = 100 / Math.max(points.length - 1, 1)
  return points
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(30 - (v / max) * 28).toFixed(1)}`)
    .join(' ')
}

const sparkSessions = computed(() => sparkPath(trends.value.map((t) => t.sessions)))
const sparkActive = computed(() => sparkPath(trends.value.map((t) => t.active_users)))
const sparkTokens = computed(() => sparkPath(trends.value.map((t) => t.tokens_total)))
const sparkCost = computed(() => sparkPath(trends.value.map((t) => t.cost_usd)))
const sparkErrors = computed(() => sparkPath(trends.value.map((t) => t.errors)))
</script>

<template>
  <section class="max-w-6xl flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Overview</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Last {{ window }} days across the install base — sessions, active users, spend, errors.
        </p>
      </div>
      <select
        v-model.number="window"
        class="text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2.5 py-1.5"
      >
        <option :value="7">7 days</option>
        <option :value="14">14 days</option>
        <option :value="30">30 days</option>
        <option :value="90">90 days</option>
      </select>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !summary" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <template v-else-if="summary">
      <!-- KPI cards w/ sparklines -->
      <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="mono text-xs text-[var(--app-muted)] tracking-wider">ACTIVE TODAY</span>
            <span
              v-if="activeDelta !== 0"
              class="text-[10px]"
              :class="activeDelta > 0 ? 'text-emerald-600' : 'text-rose-500'"
            >{{ activeDelta > 0 ? '+' : '' }}{{ activeDelta }}</span>
          </div>
          <div class="text-2xl font-semibold">{{ fmt(summary.active_today) }}</div>
          <div class="text-xs text-[var(--app-muted)]">vs {{ fmt(summary.active_yesterday) }} yesterday</div>
        </div>

        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-2">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">SESSIONS</div>
          <div class="text-2xl font-semibold">{{ fmt(summary.totals.Sessions) }}</div>
          <svg viewBox="0 0 100 30" class="h-8 w-full text-[var(--app-accent)]" preserveAspectRatio="none">
            <path :d="sparkSessions" fill="none" stroke="currentColor" stroke-width="1.2" />
          </svg>
        </div>

        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-2">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">TOKENS</div>
          <div class="text-2xl font-semibold">{{ fmt(summary.totals.TokensInput + summary.totals.TokensOutput) }}</div>
          <svg viewBox="0 0 100 30" class="h-8 w-full text-sky-500" preserveAspectRatio="none">
            <path :d="sparkTokens" fill="none" stroke="currentColor" stroke-width="1.2" />
          </svg>
        </div>

        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-2">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">SPEND</div>
          <div class="text-2xl font-semibold">
            {{ fmtUSD(summary.top_providers.reduce((s, p) => s + (p.cost_usd || 0), 0)) }}
          </div>
          <svg viewBox="0 0 100 30" class="h-8 w-full text-emerald-600" preserveAspectRatio="none">
            <path :d="sparkCost" fill="none" stroke="currentColor" stroke-width="1.2" />
          </svg>
        </div>

        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-2">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">ERRORS</div>
          <div class="text-2xl font-semibold" :class="summary.totals.Errors > 0 ? 'text-amber-600' : ''">
            {{ fmt(summary.totals.Errors) }}
          </div>
          <svg viewBox="0 0 100 30" class="h-8 w-full text-rose-500" preserveAspectRatio="none">
            <path :d="sparkErrors" fill="none" stroke="currentColor" stroke-width="1.2" />
          </svg>
        </div>
      </div>

      <!-- Active users trend (bigger) -->
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
        <div class="flex items-center justify-between mb-3">
          <span class="mono text-xs text-[var(--app-muted)] tracking-wider">DAILY ACTIVE USERS</span>
          <span class="text-xs text-[var(--app-muted)]">{{ trends.length }} days</span>
        </div>
        <svg viewBox="0 0 100 30" class="h-24 w-full text-[var(--app-accent)]" preserveAspectRatio="none">
          <path :d="sparkActive" fill="none" stroke="currentColor" stroke-width="0.8" />
        </svg>
      </div>

      <!-- Top providers + top errors + OS mix -->
      <div class="grid gap-4 md:grid-cols-3">
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">TOP PROVIDERS BY COST</div>
          <div v-if="!summary.top_providers.length" class="text-sm text-[var(--app-muted)]">No spend recorded yet.</div>
          <div v-else class="flex flex-col gap-2">
            <div v-for="p in summary.top_providers.slice(0, 5)" :key="p.provider" class="flex items-center justify-between text-sm">
              <span class="font-medium">{{ p.provider }}</span>
              <span class="text-[var(--app-muted)]">{{ fmtUSD(p.cost_usd) }}</span>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">TOP ERRORS</div>
          <div v-if="!summary.top_errors.length" class="text-sm text-[var(--app-muted)]">No errors reported. 🎉</div>
          <div v-else class="flex flex-col gap-2">
            <div v-for="e in summary.top_errors.slice(0, 5)" :key="e.error_class" class="flex items-center justify-between text-sm">
              <span class="font-mono truncate">{{ e.error_class }}</span>
              <span class="text-rose-500 font-semibold shrink-0">{{ fmt(e.count) }}</span>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">OS MIX</div>
          <div v-if="!summary.os_mix.length" class="text-sm text-[var(--app-muted)]">No devices reported yet.</div>
          <div v-else class="flex flex-col gap-2">
            <div v-for="o in summary.os_mix" :key="o.os_type" class="flex items-center justify-between text-sm">
              <span class="capitalize">{{ o.os_type || '—' }}</span>
              <span class="text-[var(--app-muted)]">{{ fmt(o.count) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
