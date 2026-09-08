<script setup lang="ts">
import { Pagination } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { type DomainRedirect, type ListRedirectsParams, listRedirects } from './api'

const redirects = ref<DomainRedirect[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const search = ref('')
const page = ref(1)
const pageSize = ref(10)

let searchTimer: ReturnType<typeof setTimeout> | null = null
let reqSeq = 0

async function load() {
  const mySeq = ++reqSeq
  loading.value = true
  error.value = ''
  const params: ListRedirectsParams = { page: page.value, limit: pageSize.value }
  if (search.value.trim()) params.search = search.value.trim()
  try {
    const res = await listRedirects(params)
    if (mySeq !== reqSeq) return
    redirects.value = res.data ?? []
    total.value = res.total ?? 0
  } catch (err) {
    if (mySeq !== reqSeq) return
    error.value = err instanceof Error ? err.message : 'Failed to load redirects'
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
watch(page, load)

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return String(iso)
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Redirects</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Every configured URL forwarding across all tenants. Useful for spotting broken loops.
      </p>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search source or target…"
        class="w-full bg-transparent text-sm outline-none placeholder:text-[var(--app-muted)]"
      />
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !redirects.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="redirects.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <div
        v-for="r in redirects"
        :key="r.id"
        class="flex items-center gap-3 px-5 py-3"
      >
        <code class="text-sm font-mono truncate flex-1">{{ r.source_domain }}</code>
        <Icon icon="lucide:arrow-right" class="size-4 text-[var(--app-muted)] shrink-0" />
        <code class="text-sm font-mono truncate flex-1">{{ r.target_domain }}</code>
        <span class="inline-flex text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          {{ r.redirect_type }}
        </span>
        <span v-if="r.include_path" class="text-[10px] uppercase tracking-wider text-[var(--app-muted)] shrink-0">+ path</span>
        <span class="text-xs text-[var(--app-muted)] shrink-0 hidden md:inline">{{ fmtDate(r.updated_at) }}</span>
      </div>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-if="!loading && !total" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:route" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No redirects configured</div>
    </div>
  </section>
</template>
