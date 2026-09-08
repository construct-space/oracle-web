<script setup lang="ts">
import { ConfirmationModal, Icon, Modal } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { approveSpace, listPendingSpaces, rejectSpace, type SpaceSummary } from './api'

const loading = ref(false)
const error = ref('')
const spaces = ref<SpaceSummary[]>([])
const search = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await listPendingSpaces()
    spaces.value = res.spaces
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load pending spaces'
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return spaces.value
  return spaces.value.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      (s.display_name || '').toLowerCase().includes(q) ||
      (s.publisher_name || '').toLowerCase().includes(q),
  )
})

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

// Drop the row from the in-memory list rather than re-fetching — the action
// either removes it from the queue or moves it to a different status, so a
// fresh listPendingSpaces() would just re-confirm it's gone.
function removeRow(id: number | string) {
  spaces.value = spaces.value.filter((s) => s.id !== id)
}

// ─── Approve ─────────────────────────────────────────────────────────────
const approveOpen = ref(false)
const approveBusy = ref(false)
const approveTarget = ref<SpaceSummary | null>(null)

function promptApprove(s: SpaceSummary) {
  approveTarget.value = s
  approveOpen.value = true
}

async function runApprove() {
  if (!approveTarget.value) return
  approveBusy.value = true
  const target = approveTarget.value
  try {
    await approveSpace(target.id)
    removeRow(target.id)
    approveOpen.value = false
    approveTarget.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Approve failed'
    approveOpen.value = false
  } finally {
    approveBusy.value = false
  }
}

// ─── Reject ──────────────────────────────────────────────────────────────
const rejectOpen = ref(false)
const rejectBusy = ref(false)
const rejectTarget = ref<SpaceSummary | null>(null)
const rejectReason = ref('')
const rejectError = ref('')

function promptReject(s: SpaceSummary) {
  rejectTarget.value = s
  rejectReason.value = ''
  rejectError.value = ''
  rejectOpen.value = true
}

async function submitReject() {
  if (!rejectTarget.value) return
  const reason = rejectReason.value.trim()
  if (!reason) {
    rejectError.value = 'Reason is required — it goes back to the publisher.'
    return
  }
  rejectBusy.value = true
  rejectError.value = ''
  const target = rejectTarget.value
  try {
    await rejectSpace(target.id, reason)
    removeRow(target.id)
    rejectOpen.value = false
    rejectTarget.value = null
  } catch (err) {
    rejectError.value = err instanceof Error ? err.message : 'Reject failed'
  } finally {
    rejectBusy.value = false
  }
}

// ─── Batch approve ─────────────────────────────────────────────────────────
// No backend batch endpoint — approve each selected space sequentially and
// surface progress. Sequential (not parallel) keeps server load sane and makes
// partial-failure reporting precise.
const selected = ref<Set<number | string>>(new Set())

function toggle(id: number | string) {
  const next = new Set(selected.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selected.value = next
}

const selectedVisible = computed(() => filtered.value.filter((s) => selected.value.has(s.id)))
const selectedCount = computed(() => selectedVisible.value.length)
const allVisibleSelected = computed(
  () => filtered.value.length > 0 && filtered.value.every((s) => selected.value.has(s.id)),
)

function toggleAll() {
  const next = new Set(selected.value)
  for (const s of filtered.value) {
    if (allVisibleSelected.value) next.delete(s.id)
    else next.add(s.id)
  }
  selected.value = next
}

const batchOpen = ref(false)
const batchBusy = ref(false)
const batchDone = ref(0)
const batchTotal = ref(0)
const batchFailed = ref<string[]>([])

function promptBatchApprove() {
  if (selectedCount.value === 0) return
  batchFailed.value = []
  batchDone.value = 0
  batchTotal.value = selectedCount.value
  batchOpen.value = true
}

async function runBatchApprove() {
  const targets = selectedVisible.value.slice() // snapshot; removeRow mutates the list
  batchBusy.value = true
  batchFailed.value = []
  batchDone.value = 0
  batchTotal.value = targets.length
  for (const s of targets) {
    try {
      await approveSpace(s.id)
      removeRow(s.id)
      const next = new Set(selected.value)
      next.delete(s.id)
      selected.value = next
    } catch {
      batchFailed.value.push(s.display_name || s.name)
    }
    batchDone.value++
  }
  batchBusy.value = false
  if (batchFailed.value.length === 0) batchOpen.value = false
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Pending spaces</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Spaces awaiting moderator review, oldest first.
      </p>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search by name or publisher…"
        class="w-full bg-transparent text-sm text-[var(--app-foreground)] outline-none placeholder:text-[var(--app-muted)]"
        aria-label="Filter pending spaces"
      />
    </div>

    <!-- Batch bar: select-all + approve selected. -->
    <div v-if="filtered.length" class="flex items-center justify-between gap-3 px-1">
      <button
        type="button"
        class="flex items-center gap-2 text-xs text-[var(--app-muted)] hover:text-[var(--app-foreground)]"
        @click="toggleAll"
      >
        <span
          class="size-4 rounded border border-[var(--app-border)] grid place-items-center"
          :class="allVisibleSelected ? 'bg-[var(--app-accent)] border-[var(--app-accent)]' : ''"
        >
          <Icon v-if="allVisibleSelected" icon="lucide:check" class="size-3 text-white" />
        </span>
        {{ allVisibleSelected ? 'Deselect all' : 'Select all' }} ({{ filtered.length }})
      </button>
      <button
        type="button"
        class="rounded-md bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="selectedCount === 0"
        @click="promptBatchApprove"
      >
        Approve selected ({{ selectedCount }})
      </button>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !spaces.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="filtered.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <RouterLink
        v-for="space in filtered"
        :key="space.id"
        :to="`/developer/spaces/${space.id}`"
        class="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--app-card-hover)]"
      >
        <button
          type="button"
          class="size-4 rounded border grid place-items-center shrink-0 transition-colors"
          :class="selected.has(space.id) ? 'bg-[var(--app-accent)] border-[var(--app-accent)]' : 'border-[var(--app-border)] hover:border-[var(--app-accent)]'"
          :title="selected.has(space.id) ? 'Deselect' : 'Select for batch approve'"
          :aria-pressed="selected.has(space.id)"
          @click.stop.prevent="toggle(space.id)"
        >
          <Icon v-if="selected.has(space.id)" icon="lucide:check" class="size-3 text-white" />
        </button>
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon :icon="`lucide:${space.icon || 'blocks'}`" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ space.display_name || space.name }}</div>
          <div class="text-xs text-[var(--app-muted)] font-mono truncate">
            {{ space.name }}<span v-if="space.version"> · v{{ space.version }}</span>
          </div>
        </div>
        <span class="text-xs text-[var(--app-muted)] w-32 shrink-0 hidden md:inline truncate">
          {{ space.publisher_name || '—' }}
        </span>
        <span class="text-xs text-[var(--app-muted)] w-16 shrink-0 hidden md:inline text-right">
          {{ fmtDate(space.updated_at) }}
        </span>
        <!-- Quick actions. stop+prevent so the row's RouterLink doesn't fire
             on button click. The detail page is still reachable from any
             other part of the row. -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            class="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs font-medium text-green-500 hover:bg-green-500/10 hover:border-green-500/40"
            title="Approve"
            @click.stop.prevent="promptApprove(space)"
          >
            <Icon icon="lucide:check" class="size-3.5" />
          </button>
          <button
            type="button"
            class="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10 hover:border-red-500/40"
            title="Reject"
            @click.stop.prevent="promptReject(space)"
          >
            <Icon icon="lucide:x" class="size-3.5" />
          </button>
        </div>
      </RouterLink>
    </div>

    <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:inbox" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">Queue empty</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        No spaces awaiting review. New submissions appear here.
      </p>
    </div>

    <ConfirmationModal
      v-model="approveOpen"
      title="Approve space"
      :message="`Approve ${approveTarget?.display_name || approveTarget?.name || 'this space'} for the marketplace?`"
      confirm-text="Approve"
      confirm-color="primary"
      :loading="approveBusy"
      @confirm="runApprove"
    />

    <Modal v-model:open="batchOpen">
      <template #header>
        <h3 class="text-lg font-semibold">Approve {{ batchTotal }} space{{ batchTotal === 1 ? '' : 's' }}</h3>
      </template>
      <template #body>
        <div v-if="!batchBusy && batchDone === 0 && !batchFailed.length" class="text-sm text-[var(--app-muted)]">
          Approve {{ batchTotal }} selected space{{ batchTotal === 1 ? '' : 's' }} for the marketplace? They go live immediately.
        </div>
        <div v-else class="flex flex-col gap-2 text-sm">
          <div class="text-[var(--app-foreground)]">
            Approved {{ batchDone - batchFailed.length }} / {{ batchTotal }}<span v-if="batchBusy">…</span>
          </div>
          <div class="h-2 rounded-full bg-[var(--app-surface)] overflow-hidden">
            <div
              class="h-full bg-green-500 transition-all"
              :style="{ width: batchTotal ? `${(batchDone / batchTotal) * 100}%` : '0%' }"
            />
          </div>
          <p v-if="batchFailed.length" class="text-xs text-red-500">
            Failed ({{ batchFailed.length }}): {{ batchFailed.join(', ') }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)] disabled:opacity-40"
            :disabled="batchBusy"
            @click="batchOpen = false"
          >{{ batchDone > 0 && !batchBusy ? 'Close' : 'Cancel' }}</button>
          <button
            type="button"
            class="rounded-md bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            :disabled="batchBusy || selectedCount === 0"
            @click="runBatchApprove"
          >{{ batchBusy ? `Approving ${batchDone}/${batchTotal}…` : batchFailed.length ? `Retry ${selectedCount}` : 'Approve all' }}</button>
        </div>
      </template>
    </Modal>

    <Modal v-model:open="rejectOpen">
      <template #header>
        <h3 class="text-lg font-semibold">
          Reject {{ rejectTarget?.display_name || rejectTarget?.name }}
        </h3>
      </template>
      <template #body>
        <form class="flex flex-col gap-3" @submit.prevent="submitReject">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Reason *</span>
            <textarea
              v-model="rejectReason"
              rows="4"
              placeholder="Explain why this submission is rejected. Sent to the publisher."
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] resize-none"
            />
          </label>
          <p v-if="rejectError" class="text-xs text-red-500">{{ rejectError }}</p>
        </form>
      </template>
      <template #footer>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]"
            :disabled="rejectBusy"
            @click="rejectOpen = false"
          >Cancel</button>
          <button
            type="button"
            class="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            :disabled="rejectBusy"
            @click="submitReject"
          >{{ rejectBusy ? 'Submitting…' : 'Reject' }}</button>
        </div>
      </template>
    </Modal>
  </section>
</template>
