<script setup lang="ts">
import { Pagination } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { type AccountUser, type ListUsersParams, listUsers } from './api'
import UserRow from './UserRow.vue'

const users = ref<AccountUser[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)

const search = ref('')
const status = ref<'' | 'active' | 'suspended'>('')
const totp = ref<'' | 'enabled' | 'disabled'>('')
const developer = ref<'' | 'yes' | 'no'>('')
const page = ref(1)
const pageSize = ref(10)

let searchTimer: ReturnType<typeof setTimeout> | null = null
let reqSeq = 0

async function load() {
  const mySeq = ++reqSeq
  loading.value = true
  error.value = null
  const params: ListUsersParams = { page: page.value, limit: pageSize.value }
  if (search.value.trim()) params.search = search.value.trim()
  if (status.value) params.status = status.value
  if (totp.value) params.totp = totp.value
  if (developer.value) params.developer = developer.value
  try {
    const res = await listUsers(params)
    // Drop stale responses — if the user typed fast, only the latest wins.
    if (mySeq !== reqSeq) return
    users.value = res.data
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

// Filter/search changes reset to page 1 and refetch (search debounced).
watch(search, () => {
  page.value = 1
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 300)
})
watch([status, totp, developer], () => {
  page.value = 1
  load()
})
watch(page, load)

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Users</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Browse accounts, inspect status, and jump into user detail.
      </p>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search by name, email, or username..."
        class="w-full bg-transparent text-sm text-[var(--app-foreground)] outline-none placeholder:text-[var(--app-muted)]"
        aria-label="Filter users"
      />
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <select
        v-model="status"
        class="text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2.5 py-1.5 text-[var(--app-foreground)]"
        aria-label="Status filter"
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
      </select>
      <select
        v-model="totp"
        class="text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2.5 py-1.5 text-[var(--app-foreground)]"
        aria-label="2FA filter"
      >
        <option value="">Any 2FA</option>
        <option value="enabled">2FA enabled</option>
        <option value="disabled">2FA off</option>
      </select>
      <select
        v-model="developer"
        class="text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2.5 py-1.5 text-[var(--app-foreground)]"
        aria-label="Developer filter"
      >
        <option value="">Any role</option>
        <option value="yes">Developer</option>
        <option value="no">Non-developer</option>
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

    <div v-if="loading && !users.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="users.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
      aria-live="polite"
    >
      <UserRow v-for="user in users" :key="user.id" :user="user" />
    </div>

    <div v-if="total > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="total" :page-count="pageSize" />
    </div>

    <div v-else-if="!loading && !total" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:users" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No users match your filters</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Try loosening the search or clearing a filter.
      </p>
    </div>
  </section>
</template>
