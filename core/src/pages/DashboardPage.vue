<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { oracleSpaces } from '../spaces'

// Overview endpoint gives us the small calm numbers at the top. Delivery
// and domains have richer stats but live behind their own proxies — don't
// fan out here, keep this page cheap. Space cards link into those.
interface Overview {
  users: number
  administrators: number
}
const overview = ref<Overview | null>(null)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/dashboard/overview', { credentials: 'include' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    overview.value = (await res.json()) as Overview
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load overview'
  } finally {
    loading.value = false
  }
}

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Compact header — no giant titles. -->
    <header class="flex items-end justify-between gap-4">
      <div>
        <p class="text-xs font-medium tracking-wider uppercase text-[var(--app-muted)]">Oracle</p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight">{{ greeting }}.</h1>
      </div>
      <span class="text-xs text-[var(--app-muted)]">{{ new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) }}</span>
    </header>

    <!-- Stats strip -->
    <section class="grid gap-3 md:grid-cols-4">
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
        <div class="text-xs tracking-wider uppercase text-[var(--app-muted)] font-medium">Users</div>
        <div class="text-2xl font-semibold">
          <span v-if="overview">{{ overview.users.toLocaleString() }}</span>
          <span v-else-if="loading" class="text-[var(--app-muted)] text-base">—</span>
          <span v-else class="text-rose-500 text-base">err</span>
        </div>
        <div class="text-xs text-[var(--app-muted)]">Registered accounts.</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
        <div class="text-xs tracking-wider uppercase text-[var(--app-muted)] font-medium">Administrators</div>
        <div class="text-2xl font-semibold">
          <span v-if="overview">{{ overview.administrators }}</span>
          <span v-else-if="loading" class="text-[var(--app-muted)] text-base">—</span>
          <span v-else class="text-rose-500 text-base">err</span>
        </div>
        <div class="text-xs text-[var(--app-muted)]">Active staff on Oracle.</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
        <div class="text-xs tracking-wider uppercase text-[var(--app-muted)] font-medium">Spaces</div>
        <div class="text-2xl font-semibold">{{ oracleSpaces.length }}</div>
        <div class="text-xs text-[var(--app-muted)]">Operator surfaces.</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
        <div class="text-xs tracking-wider uppercase text-[var(--app-muted)] font-medium">Today</div>
        <div class="text-2xl font-semibold tabular-nums">{{ new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }}</div>
        <div class="text-xs text-[var(--app-muted)]">{{ new Date().getFullYear() }}</div>
      </div>
    </section>

    <div v-if="error" class="text-sm text-rose-500 flex items-center gap-2">
      <Icon icon="lucide:alert-circle" class="size-4" />
      <span>Overview: {{ error }}</span>
    </div>

    <!-- Space grid -->
    <section class="flex flex-col gap-3">
      <h2 class="text-xs tracking-wider uppercase text-[var(--app-muted)] font-medium">Operator surfaces</h2>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <RouterLink
          v-for="space in oracleSpaces"
          :key="space.id"
          :to="space.home"
          class="group rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 transition-all hover:border-[var(--app-accent)] hover:bg-[var(--app-card-hover)] flex flex-col gap-3"
        >
          <div class="flex items-start gap-3">
            <div class="size-9 rounded-lg grid place-items-center bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] text-[var(--app-accent)] shrink-0">
              <Icon :icon="`lucide:${space.icon}`" class="size-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold">{{ space.title }}</div>
              <div class="text-xs text-[var(--app-muted)] line-clamp-2 mt-0.5">{{ space.description }}</div>
            </div>
            <Icon icon="lucide:arrow-up-right" class="size-4 text-[var(--app-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
          </div>
          <div v-if="space.links.length" class="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--app-border)]">
            <span
              v-for="link in space.links.slice(0, 4)"
              :key="link.path"
              class="inline-flex items-center gap-1 text-[11px] text-[var(--app-muted)] px-1.5 py-0.5 rounded-md bg-[var(--app-surface)]"
            >
              <Icon :icon="`lucide:${link.icon}`" class="size-3" />
              {{ link.label }}
            </span>
            <span
              v-if="space.links.length > 4"
              class="text-[11px] text-[var(--app-muted)] px-1.5 py-0.5"
            >+{{ space.links.length - 4 }} more</span>
          </div>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
