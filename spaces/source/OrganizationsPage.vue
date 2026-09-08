<script setup lang="ts">
import { Pagination } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { type ListOrgsParams, listOrgs, type OrgListItem } from './api'

const orgs = ref<OrgListItem[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
const search = ref('')
const page = ref(1)
const pageSize = ref(10)

let searchTimer: ReturnType<typeof setTimeout> | null = null
let reqSeq = 0

async function load() {
  const mySeq = ++reqSeq
  loading.value = true
  error.value = null
  const params: ListOrgsParams = { page: page.value, limit: pageSize.value }
  if (search.value.trim()) params.q = search.value.trim()
  try {
    const res = await listOrgs(params)
    if (mySeq !== reqSeq) return
    orgs.value = res.orgs
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
watch(page, load)

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Organizations</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">Every organization on Construct, with member and project counts.</p>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search by name or slug…"
        class="w-full bg-transparent text-sm text-[var(--app-foreground)] outline-none placeholder:text-[var(--app-muted)]"
        aria-label="Filter organizations"
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

    <div v-if="loading && !orgs.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="orgs.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <RouterLink
        v-for="org in orgs"
        :key="org.id"
        :to="`/source/organizations/${org.id}`"
        class="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--app-card-hover)]"
      >
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon :icon="`lucide:${org.icon || 'building-2'}`" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ org.name }}</div>
          <div class="text-xs text-[var(--app-muted)] font-mono truncate">{{ org.slug }}</div>
        </div>
        <div class="hidden md:flex items-center gap-4 text-xs text-[var(--app-muted)] shrink-0">
          <span><strong class="text-[var(--app-foreground)]">{{ org.member_count }}</strong> members</span>
          <span><strong class="text-[var(--app-foreground)]">{{ org.project_count }}</strong> projects</span>
          <span><strong class="text-[var(--app-foreground)]">{{ org.team_count }}</strong> teams</span>
        </div>
        <span
          v-if="org.pending_invite_count > 0"
          class="inline-flex text-xs font-medium px-2 py-0.5 rounded bg-sky-500/15 text-sky-600 shrink-0"
        >
          {{ org.pending_invite_count }} pending
        </span>
      </RouterLink>
    </div>

    <div v-else-if="!loading && !total" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:building-2" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No organizations match your search</div>
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>
  </section>
</template>
