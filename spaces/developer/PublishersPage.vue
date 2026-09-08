<script setup lang="ts">
import { Pagination } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { type ListPublishersParams, listPublishers, type PublisherListItem } from './api'

const publishers = ref<PublisherListItem[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)

const search = ref('')
const kind = ref<'' | 'user' | 'org' | 'legacy'>('')
const verified = ref<'' | 'true' | 'false'>('')
const page = ref(1)
const pageSize = ref(10)

let searchTimer: ReturnType<typeof setTimeout> | null = null
let reqSeq = 0

async function load() {
  const mySeq = ++reqSeq
  loading.value = true
  error.value = null
  const params: ListPublishersParams = { page: page.value, limit: pageSize.value }
  if (search.value.trim()) params.q = search.value.trim()
  if (kind.value) params.kind = kind.value
  if (verified.value) params.verified = verified.value
  try {
    const res = await listPublishers(params)
    if (mySeq !== reqSeq) return
    publishers.value = res.publishers
    total.value = res.total
  } catch (e) {
    if (mySeq !== reqSeq) return
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (mySeq === reqSeq) loading.value = false
  }
}

const rangeLabel = computed(() => {
  if (!total.value) return '0'
  const start = (page.value - 1) * pageSize.value + 1
  const end = Math.min(start + pageSize.value - 1, total.value)
  return `${start}–${end} of ${total.value}`
})

watch(search, () => {
  page.value = 1
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 300)
})
watch([kind, verified], () => {
  page.value = 1
  load()
})
watch(page, load)

function kindBadgeClass(k: string): string {
  switch (k) {
    case 'user':
      return 'bg-sky-500/15 text-sky-600'
    case 'org':
      return 'bg-violet-500/15 text-violet-600'
    case 'legacy':
      return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
    default:
      return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Publishers</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">Review publisher identity, verification, and their published spaces.</p>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search by name or email…"
        class="w-full bg-transparent text-sm text-[var(--app-foreground)] outline-none placeholder:text-[var(--app-muted)]"
        aria-label="Filter publishers"
      />
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <select
        v-model="kind"
        class="text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2.5 py-1.5 text-[var(--app-foreground)]"
        aria-label="Kind filter"
      >
        <option value="">All kinds</option>
        <option value="user">Personal (user)</option>
        <option value="org">Organization</option>
        <option value="legacy">Legacy</option>
      </select>
      <select
        v-model="verified"
        class="text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2.5 py-1.5 text-[var(--app-foreground)]"
        aria-label="Verified filter"
      >
        <option value="">Any verification</option>
        <option value="true">Verified</option>
        <option value="false">Unverified</option>
      </select>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !publishers.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="publishers.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <RouterLink
        v-for="publisher in publishers"
        :key="publisher.id"
        :to="`/developer/publishers/${publisher.id}`"
        class="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--app-card-hover)]"
      >
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon :icon="publisher.kind === 'org' ? 'lucide:building-2' : 'lucide:user'" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ publisher.name }}</div>
          <div class="text-xs text-[var(--app-muted)] truncate">{{ publisher.email || '—' }}</div>
        </div>
        <span class="inline-flex text-xs font-medium px-2 py-0.5 rounded shrink-0" :class="kindBadgeClass(publisher.kind)">
          {{ publisher.kind }}
        </span>
        <span class="text-xs text-[var(--app-muted)] w-16 shrink-0 hidden md:inline text-right">{{ publisher.space_count }} spaces</span>
        <span
          class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0"
          :class="publisher.verified ? 'bg-emerald-500/15 text-emerald-600' : 'bg-[var(--app-surface)] text-[var(--app-muted)]'"
        >
          {{ publisher.verified ? 'Verified' : 'Unverified' }}
        </span>
      </RouterLink>
    </div>

    <div v-else-if="!loading && !total" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:package-open" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No publishers match your filters</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Try clearing a filter or changing the search term.
      </p>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>
  </section>
</template>
