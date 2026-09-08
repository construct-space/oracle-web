<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { type APIKey, listAPIKeys } from './api'

const keys = ref<APIKey[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    keys.value = (await listAPIKeys()).keys ?? []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load API keys'
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return keys.value
  return keys.value.filter((k) => k.name.toLowerCase().includes(q) || k.prefix.toLowerCase().includes(q))
})

function fmtDateTime(iso?: string | null): string {
  if (!iso) return 'Never'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">API keys</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Delivery credentials issued to tenants. Read-only view — key lifecycle runs on tenants' own portals.
      </p>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search by name or prefix…"
        class="w-full bg-transparent text-sm outline-none placeholder:text-[var(--app-muted)]"
      />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !keys.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="filtered.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <div v-for="key in filtered" :key="key.id" class="flex items-center gap-4 px-5 py-3">
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:key-square" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ key.name }}</div>
          <div class="text-xs text-[var(--app-muted)] font-mono truncate">{{ key.prefix }}…</div>
        </div>
        <span class="text-xs text-[var(--app-muted)] shrink-0 hidden md:inline">
          last used {{ fmtDateTime(key.last_used_at) }}
        </span>
      </div>
    </div>

    <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:key-square" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No API keys match your search</div>
    </div>
  </section>
</template>
