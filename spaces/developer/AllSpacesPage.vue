<script setup lang="ts">
/**
 * All Spaces — Oracle's omnibus space list.
 *
 * Sourced from graph (every space with runtime presence: schema, bundle,
 * or installs), then enriched in a single batch from developer for the
 * marketplace-lifecycle subset (status, publisher, recommended,
 * reviewed_at, build_size). Spaces present on graph but never submitted
 * to developer's review pipeline render with status = "not submitted",
 * which is a real first-class state — not all runtime spaces opt into
 * marketplace review.
 *
 * Why this split: developer used to be the sole source for All Spaces,
 * which meant Oracle was blind to the (often larger) set of spaces that
 * have a graph schema or bundle but were never submitted. Reviewers were
 * effectively making decisions on a partial dataset.
 */
import { ConfirmationModal, Modal, Pagination } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  approveSpace,
  batchSpaceStatus,
  deleteGraphSpace,
  type GraphSpaceRow,
  listAllSpaces,
  rejectSpace,
  type SpaceStatusInfo,
} from './api'

interface Row {
  // Graph-side identity (used by the route + as the key into the
  // developer status map). Always present.
  graphId: string
  name: string
  latestVersion?: string
  bundleId?: string
  distribution?: string
  installCount?: number
  publisherOrgId?: string
  // Developer-side overlay. Absent when the space never went through
  // marketplace review — UI surfaces that as "not submitted".
  developerId?: number
  status?: string
  recommended?: boolean
  publisherName?: string
  reviewedAt?: string
  // Display-only — graph stores the display name in `name` (and the slug
  // in `id`). developer.spaces is keyed by slug, so we batch by `g.id`
  // and render `g.name` as the label.
  displayName?: string
}

const loading = ref(false)
const error = ref('')
const rows = ref<Row[]>([])
const search = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = ref(20)

async function load() {
  loading.value = true
  error.value = ''
  try {
    // 1. Pull every space from graph.
    const graphRes = await listAllSpaces()
    const graphSpaces: GraphSpaceRow[] = graphRes.spaces || []
    if (graphSpaces.length === 0) {
      rows.value = []
      return
    }

    // 2. Batch-resolve marketplace status by slug. developer.spaces.name
    // is the slug (e.g. "library"), which matches graph.spaces.id — not
    // graph.spaces.name (which holds the display label "Library").
    let statuses: Record<string, SpaceStatusInfo> = {}
    try {
      const r = await batchSpaceStatus(graphSpaces.map((s) => s.id))
      statuses = r.statuses || {}
    } catch {
      // Developer outage shouldn't blank the list — degrade to "no status
      // available" for every row instead of failing the page.
      statuses = {}
    }

    // 3. Join. Keep graph as primary; overlay developer where present.
    // row.name carries the slug so the detail-page route resolves correctly;
    // row.displayName carries the human label.
    rows.value = graphSpaces.map((g): Row => {
      const status = statuses[g.id]
      return {
        graphId: g.id,
        name: g.id,
        latestVersion: g.latest_version,
        bundleId: g.bundle_id,
        distribution: g.distribution,
        installCount: g.install_count,
        publisherOrgId: g.publisher_org_id,
        developerId: status?.id,
        status: status?.status ?? 'not_submitted',
        recommended: status?.recommended,
        publisherName: status?.publisher?.name,
        reviewedAt: status?.reviewedAt,
        displayName: g.name,
      }
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load spaces'
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  let result = rows.value
  if (statusFilter.value) result = result.filter((r) => r.status === statusFilter.value)
  const q = search.value.trim().toLowerCase()
  if (q) {
    result = result.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.displayName || '').toLowerCase().includes(q) ||
        (r.publisherName || '').toLowerCase().includes(q),
    )
  }
  return result
})

const paginated = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

const rangeLabel = computed(() => {
  if (!filtered.value.length) return '0'
  const start = (page.value - 1) * pageSize.value + 1
  const end = Math.min(start + pageSize.value - 1, filtered.value.length)
  return `${start}–${end} of ${filtered.value.length}`
})

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
    case 'not_submitted':
      return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
    default:
      return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
  }
}

function statusLabel(status?: string): string {
  if (!status) return ''
  if (status === 'not_submitted') return 'not submitted'
  return status.replace('_', ' ')
}

// Detail page is keyed by developer id when the space has been submitted;
// for not-submitted spaces, key by name (developer's GET handler resolves
// numeric or name) — yields a graceful 404 the detail page handles.
function detailRoute(r: Row): string {
  return `/developer/spaces/${r.developerId ?? r.name}`
}

// ─── Inline actions (approve/reject pending; delete not-submitted) ───────
//
// Drop the row from in-memory rather than re-loading: approve/reject moves
// the space to a status the user can re-check via the filter, and delete
// removes it from graph (and developer) entirely. Either way a re-fetch
// would just re-confirm the new state.
function removeRow(graphId: string) {
  rows.value = rows.value.filter((r) => r.graphId !== graphId)
}

const approveOpen = ref(false)
const approveBusy = ref(false)
const approveTarget = ref<Row | null>(null)

function promptApprove(r: Row) {
  approveTarget.value = r
  approveOpen.value = true
}

async function runApprove() {
  if (!approveTarget.value?.developerId) return
  approveBusy.value = true
  const target = approveTarget.value
  try {
    await approveSpace(target.developerId as number)
    removeRow(target.graphId)
    approveOpen.value = false
    approveTarget.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Approve failed'
    approveOpen.value = false
  } finally {
    approveBusy.value = false
  }
}

const rejectOpen = ref(false)
const rejectBusy = ref(false)
const rejectTarget = ref<Row | null>(null)
const rejectReason = ref('')
const rejectError = ref('')

function promptReject(r: Row) {
  rejectTarget.value = r
  rejectReason.value = ''
  rejectError.value = ''
  rejectOpen.value = true
}

async function submitReject() {
  if (!rejectTarget.value?.developerId) return
  const reason = rejectReason.value.trim()
  if (!reason) {
    rejectError.value = 'Reason is required — it goes back to the publisher.'
    return
  }
  rejectBusy.value = true
  rejectError.value = ''
  const target = rejectTarget.value
  try {
    await rejectSpace(target.developerId as number, reason)
    removeRow(target.graphId)
    rejectOpen.value = false
    rejectTarget.value = null
  } catch (err) {
    rejectError.value = err instanceof Error ? err.message : 'Reject failed'
  } finally {
    rejectBusy.value = false
  }
}

const deleteOpen = ref(false)
const deleteBusy = ref(false)
const deleteTarget = ref<Row | null>(null)

function promptDelete(r: Row) {
  deleteTarget.value = r
  deleteOpen.value = true
}

async function runDelete() {
  if (!deleteTarget.value) return
  deleteBusy.value = true
  const target = deleteTarget.value
  try {
    await deleteGraphSpace(target.graphId)
    removeRow(target.graphId)
    deleteOpen.value = false
    deleteTarget.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Delete failed'
    deleteOpen.value = false
  } finally {
    deleteBusy.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">All spaces</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Every space with runtime presence on graph. Marketplace status is overlaid for spaces that submitted for review.
      </p>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search by name or publisher…"
        class="w-full bg-transparent text-sm text-[var(--app-foreground)] outline-none placeholder:text-[var(--app-muted)]"
      />
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <select
        v-model="statusFilter"
        class="text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2.5 py-1.5 text-[var(--app-foreground)]"
        aria-label="Status filter"
      >
        <option value="">All statuses</option>
        <option value="not_submitted">Not submitted</option>
        <option value="pending_review">Pending review</option>
        <option value="approved">Approved</option>
        <option value="changes_requested">Changes requested</option>
        <option value="rejected">Rejected</option>
        <option value="unpublished">Unpublished</option>
      </select>
    </div>

    <div v-if="filtered.length > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="filtered.length" :page-count="pageSize" />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !rows.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="paginated.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <RouterLink
        v-for="row in paginated"
        :key="row.graphId"
        :to="detailRoute(row)"
        class="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--app-card-hover)]"
      >
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:blocks" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium truncate">{{ row.displayName || row.name }}</span>
            <Icon
              v-if="row.recommended"
              icon="lucide:star"
              class="size-3.5 text-amber-500 shrink-0"
              title="Recommended"
            />
          </div>
          <div class="text-xs text-[var(--app-muted)] font-mono truncate">
            {{ row.name }}<span v-if="row.latestVersion"> · v{{ row.latestVersion }}</span>
          </div>
        </div>
        <span class="text-xs text-[var(--app-muted)] w-32 shrink-0 hidden md:inline truncate">
          {{ row.publisherName || '—' }}
        </span>
        <span v-if="row.installCount !== undefined" class="text-xs text-[var(--app-muted)] w-16 shrink-0 hidden md:inline tabular-nums text-right">
          {{ row.installCount }} {{ row.installCount === 1 ? 'install' : 'installs' }}
        </span>
        <span class="inline-flex text-xs font-medium px-2 py-0.5 rounded shrink-0" :class="statusPill(row.status)">
          {{ statusLabel(row.status) }}
        </span>

        <!-- Inline actions, status-gated:
             pending_review → approve + reject (developer.spaces row exists)
             not_submitted  → delete (graph orphan; cascade-drop schemas + manifest)
             others         → no quick actions; reviewer opens detail. -->
        <div class="flex items-center gap-1.5 shrink-0 w-20 justify-end">
          <template v-if="row.status === 'pending_review' && row.developerId">
            <button
              type="button"
              class="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs font-medium text-green-500 hover:bg-green-500/10 hover:border-green-500/40"
              title="Approve"
              @click.stop.prevent="promptApprove(row)"
            >
              <Icon icon="lucide:check" class="size-3.5" />
            </button>
            <button
              type="button"
              class="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10 hover:border-red-500/40"
              title="Reject"
              @click.stop.prevent="promptReject(row)"
            >
              <Icon icon="lucide:x" class="size-3.5" />
            </button>
          </template>
          <button
            v-else-if="row.status === 'not_submitted'"
            type="button"
            class="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs font-medium text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/40"
            title="Delete from graph"
            @click.stop.prevent="promptDelete(row)"
          >
            <Icon icon="lucide:trash-2" class="size-3.5" />
          </button>
        </div>
      </RouterLink>
    </div>

    <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:blocks" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No spaces match your filters</div>
    </div>

    <div v-if="filtered.length > pageSize" class="flex items-center justify-between gap-3">
      <span class="text-xs text-[var(--app-muted)]">Showing {{ rangeLabel }}</span>
      <Pagination v-model="page" :total="filtered.length" :page-count="pageSize" />
    </div>

    <ConfirmationModal
      v-model="approveOpen"
      title="Approve space"
      :message="`Approve ${approveTarget?.displayName || approveTarget?.name || 'this space'} for the marketplace?`"
      confirm-text="Approve"
      confirm-color="primary"
      :loading="approveBusy"
      @confirm="runApprove"
    />

    <ConfirmationModal
      v-model="deleteOpen"
      title="Delete from graph"
      :message="`Drop every schema, manifest, and registry row for ${deleteTarget?.displayName || deleteTarget?.name || 'this space'}? This cannot be undone — installed tenants will lose runtime data.`"
      confirm-text="Delete"
      confirm-color="error"
      :loading="deleteBusy"
      @confirm="runDelete"
    />

    <Modal v-model:open="rejectOpen">
      <template #header>
        <h3 class="text-lg font-semibold">
          Reject {{ rejectTarget?.displayName || rejectTarget?.name }}
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
