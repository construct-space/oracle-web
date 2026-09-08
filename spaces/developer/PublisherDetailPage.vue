<script setup lang="ts">
import { ConfirmationModal } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getPublisher, type PublisherDetail, unverifyPublisher, verifyPublisher } from './api'

const route = useRoute()
const loading = ref(false)
const error = ref('')
const publisher = ref<PublisherDetail | null>(null)

const publisherId = computed(() => String(route.params.id || ''))

async function load() {
  if (!publisherId.value) return
  loading.value = true
  error.value = ''
  try {
    publisher.value = await getPublisher(publisherId.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load publisher'
  } finally {
    loading.value = false
  }
}

// ─── Verify/unverify confirm ─────────────────────────────────────────────
const confirmOpen = ref(false)
const confirmBusy = ref(false)
const pendingAction = ref<'verify' | 'unverify' | null>(null)

function promptVerify() {
  pendingAction.value = 'verify'
  confirmOpen.value = true
}
function promptUnverify() {
  pendingAction.value = 'unverify'
  confirmOpen.value = true
}

async function runPending() {
  if (!publisher.value || !pendingAction.value) return
  confirmBusy.value = true
  try {
    if (pendingAction.value === 'verify') await verifyPublisher(publisher.value.id)
    else await unverifyPublisher(publisher.value.id)
    confirmOpen.value = false
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Action failed'
    confirmOpen.value = false
  } finally {
    confirmBusy.value = false
    pendingAction.value = null
  }
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(iso)
  }
}

function statusPill(status?: string): string {
  switch (status) {
    case 'approved':
    case 'published':
      return 'bg-emerald-500/15 text-emerald-600'
    case 'pending_review':
      return 'bg-sky-500/15 text-sky-600'
    case 'changes_requested':
      return 'bg-amber-500/15 text-amber-600'
    case 'rejected':
    case 'unpublished':
      return 'bg-rose-500/15 text-rose-500'
    default:
      return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div v-if="loading" class="text-sm text-[var(--app-muted)]">Loading publisher…</div>
    <div v-else-if="error && !publisher" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <template v-else-if="publisher">
      <div class="flex items-center gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-5 py-4">
        <div class="size-12 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon :icon="publisher.kind === 'org' ? 'lucide:building-2' : 'lucide:user'" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <h1 class="text-xl font-semibold truncate">{{ publisher.name }}</h1>
          <div class="text-sm text-[var(--app-muted)] truncate">{{ publisher.email || '—' }}</div>
        </div>
        <span
          class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0"
          :class="publisher.verified ? 'bg-emerald-500/15 text-emerald-600' : 'bg-[var(--app-surface)] text-[var(--app-muted)]'"
        >
          {{ publisher.verified ? 'Verified' : 'Unverified' }}
        </span>
      </div>

      <div v-if="error && publisher" class="flex items-start gap-2 text-sm text-red-500" role="alert">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-2">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">IDENTITY</div>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt class="text-[var(--app-muted)]">Kind</dt>
            <dd>{{ publisher.kind }}</dd>
            <dt class="text-[var(--app-muted)]">Website</dt>
            <dd class="truncate">{{ publisher.website || '—' }}</dd>
            <dt class="text-[var(--app-muted)]">User ID</dt>
            <dd class="font-mono text-xs">{{ publisher.user_id || '—' }}</dd>
            <dt class="text-[var(--app-muted)]">Org ID</dt>
            <dd class="font-mono text-xs">{{ publisher.org_id || '—' }}</dd>
            <dt class="text-[var(--app-muted)]">Created</dt>
            <dd>{{ fmtDate(publisher.created_at) }}</dd>
          </dl>
        </div>

        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">ACTIONS</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="!publisher.verified"
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]"
              @click="promptVerify"
            >
              <Icon icon="lucide:badge-check" class="size-3.5" />
              Verify publisher
            </button>
            <button
              v-else
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]"
              @click="promptUnverify"
            >
              <Icon icon="lucide:badge-x" class="size-3.5" />
              Unverify
            </button>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">
          SPACES ({{ publisher.spaces.length }})
        </div>
        <div
          v-if="publisher.spaces.length"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
        >
          <RouterLink
            v-for="space in publisher.spaces"
            :key="space.id"
            :to="`/developer/spaces/${space.id}`"
            class="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-[var(--app-card-hover)]"
          >
            <div class="size-8 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
              <Icon :icon="`lucide:${space.icon || 'blocks'}`" class="size-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ space.display_name || space.name }}</div>
              <div class="text-xs text-[var(--app-muted)] font-mono truncate">
                {{ space.name }}<span v-if="space.version"> · v{{ space.version }}</span>
              </div>
            </div>
            <span v-if="space.status" class="inline-flex text-xs font-medium px-2 py-0.5 rounded shrink-0" :class="statusPill(space.status)">
              {{ space.status.replace('_', ' ') }}
            </span>
          </RouterLink>
        </div>
        <div v-else class="text-sm text-[var(--app-muted)] px-5 py-3 rounded-xl border border-dashed border-[var(--app-border)]">
          No spaces published yet.
        </div>
      </div>
    </template>

    <ConfirmationModal
      v-model="confirmOpen"
      :title="pendingAction === 'verify' ? 'Verify publisher' : 'Unverify publisher'"
      :message="pendingAction === 'verify'
        ? `Mark ${publisher?.name ?? 'this publisher'} as verified? This shows a verified badge on their spaces.`
        : `Remove verified status from ${publisher?.name ?? 'this publisher'}? The badge will be hidden on their spaces.`"
      :confirm-text="pendingAction === 'verify' ? 'Verify' : 'Unverify'"
      :confirm-color="pendingAction === 'unverify' ? 'error' : 'primary'"
      :loading="confirmBusy"
      @confirm="runPending"
    />
  </section>
</template>
