<script setup lang="ts">
import { ConfirmationModal, Modal } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  approveSpace,
  deleteGraphSpace,
  deleteSpace,
  getSpace,
  listSpacePublishes,
  publishSourceURL,
  rejectSpace,
  requestChangesSpace,
  type SpaceDetail,
  type SpacePublishItem,
  spaceLatestSourceURL,
  toggleRecommended,
  transferSpace,
  unpublishSpace,
  updateSpace,
} from './api'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const error = ref('')
const space = ref<SpaceDetail | null>(null)

const spaceId = computed(() => String(route.params.id || ''))

// ─── Edit drawer ──────────────────────────────────────────────────────────
// Uses AdminUpdateSpace's whitelist (display_name, description, icon,
// scope, author). Status is owned by the moderation buttons; keeping that
// concern off this form prevents mode-confusion between "edit metadata"
// and "review decision".
const editOpen = ref(false)
const editBusy = ref(false)
const editError = ref('')
const editForm = reactive({
  display_name: '',
  description: '',
  icon: '',
  scope: '',
  author: '',
})

function openEdit() {
  if (!space.value) return
  editForm.display_name = space.value.display_name || ''
  editForm.description = space.value.description || ''
  editForm.icon = space.value.icon || ''
  editForm.scope = space.value.scope || ''
  editForm.author = space.value.author || ''
  editError.value = ''
  editOpen.value = true
}

async function submitEdit() {
  if (!space.value) return
  editBusy.value = true
  editError.value = ''
  try {
    // Only send fields that changed; undefined is dropped by JSON.stringify,
    // and the server treats missing fields as "leave alone".
    await updateSpace(space.value.id, {
      display_name: editForm.display_name.trim() || undefined,
      description: editForm.description,
      icon: editForm.icon.trim() || undefined,
      scope: editForm.scope.trim() || undefined,
      author: editForm.author.trim() || undefined,
    })
    editOpen.value = false
    await load()
  } catch (err) {
    editError.value = err instanceof Error ? err.message : 'Update failed'
  } finally {
    editBusy.value = false
  }
}

// ─── Hard-delete ──────────────────────────────────────────────────────────
// Split from the approve/toggle confirm flow so the destructive copy has
// to be typed (name confirmation) instead of one-click. Prevents accidents
// when clicking through a list of spaces fast.
const deleteOpen = ref(false)
const deleteBusy = ref(false)
const deleteError = ref('')
const deleteTyped = ref('')

function openDelete() {
  deleteTyped.value = ''
  deleteError.value = ''
  deleteOpen.value = true
}

const deleteMatches = computed(() => {
  if (!space.value) return false
  return deleteTyped.value.trim() === space.value.name
})

async function submitDelete() {
  if (!space.value || !deleteMatches.value) return
  deleteBusy.value = true
  deleteError.value = ''
  try {
    await deleteSpace(space.value.id)
    deleteOpen.value = false
    router.push('/developer/spaces')
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Delete failed'
  } finally {
    deleteBusy.value = false
  }
}

// ─── Transfer ──────────────────────────────────────────────────────────────
// Admin override — directly rewrites ownership without going through the
// owner-initiated propose/accept flow. Use for remediation (e.g. moving a
// space from a personal account that disappeared to the rightful org).
const transferOpen = ref(false)
const transferBusy = ref(false)
const transferError = ref('')
const transferKind = ref<'user' | 'org'>('org')
const transferUuid = ref('')

function openTransfer() {
  transferKind.value = space.value?.ownerOrgId ? 'org' : 'user'
  transferUuid.value = ''
  transferError.value = ''
  transferOpen.value = true
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => { /* ignore */ })
}

async function submitTransfer() {
  if (!space.value) return
  const uuid = transferUuid.value.trim()
  if (!uuid) {
    transferError.value = 'UUID is required'
    return
  }
  transferBusy.value = true
  transferError.value = ''
  try {
    const target = transferKind.value === 'user' ? { to_user_id: uuid } : { to_org_id: uuid }
    const result = await transferSpace(space.value.id, target)
    space.value = {
      ...space.value,
      ownerUserId: result.ownerUserId || undefined,
      ownerOrgId: result.ownerOrgId || undefined,
    }
    transferOpen.value = false
  } catch (err) {
    transferError.value = err instanceof Error ? err.message : 'Transfer failed'
  } finally {
    transferBusy.value = false
  }
}

// ─── Publish history ──────────────────────────────────────────────────────
// Append-only audit list — survives ownership transfers because each row
// captures the owner snapshot at publish time. Source download is gated
// per-row on the audit row's hasSource flag (rows from the pre-history
// era won't have it; current publishes always do).
const publishes = ref<SpacePublishItem[]>([])
const publishesLoading = ref(false)

async function loadPublishes() {
  if (!spaceId.value) return
  publishesLoading.value = true
  try {
    const data = await listSpacePublishes(spaceId.value)
    publishes.value = data.publishes || []
  } catch {
    publishes.value = []
  } finally {
    publishesLoading.value = false
  }
}

function downloadLatestSource() {
  if (!space.value) return
  // Native browser download via direct navigation. fetch+blob would
  // double-buffer the entire archive in memory for no UX gain.
  window.location.href = spaceLatestSourceURL(space.value.id)
}

function downloadPublishSource(p: SpacePublishItem) {
  window.location.href = publishSourceURL(p.id)
}

// True when the space exists on graph but has no developer row — admin
// landed here from the All Spaces list for a space that was never
// submitted to marketplace review. Detail page degrades to "no review
// actions available" but still shows the identifier so admins know
// they're looking at a real graph-side row, not a dead link.
const notSubmitted = ref(false)

// Cascade-delete the graph orphan from the not-submitted state. Same
// endpoint AllSpacesPage uses; lives here so admins don't have to bounce
// back to the list to clean up a never-submitted row.
const orphanDeleteOpen = ref(false)
const orphanDeleteBusy = ref(false)
const orphanDeleteError = ref('')

async function runOrphanDelete() {
  if (!spaceId.value) return
  orphanDeleteBusy.value = true
  orphanDeleteError.value = ''
  try {
    await deleteGraphSpace(spaceId.value)
    orphanDeleteOpen.value = false
    router.push('/developer/spaces')
  } catch (err) {
    orphanDeleteError.value = err instanceof Error ? err.message : 'Delete failed'
  } finally {
    orphanDeleteBusy.value = false
  }
}

async function load() {
  if (!spaceId.value) return
  loading.value = true
  error.value = ''
  notSubmitted.value = false
  try {
    space.value = await getSpace(spaceId.value)
    await loadPublishes()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load space'
    // 404 from developer means "not in marketplace lifecycle" — render
    // the not-submitted state instead of a generic error. Surfaces for
    // any other failure mode unchanged.
    if (/not.?found|404/i.test(msg)) {
      notSubmitted.value = true
      space.value = null
    } else {
      error.value = msg
    }
  } finally {
    loading.value = false
  }
}

// ─── Simple confirm actions (approve, toggle-recommended) ────────────────
const confirmOpen = ref(false)
const confirmBusy = ref(false)
interface SimpleAction {
  title: string
  message: string
  confirm: string
  destructive: boolean
  run: () => Promise<unknown>
}
const pending = ref<SimpleAction | null>(null)

function promptAction(a: SimpleAction) {
  pending.value = a
  confirmOpen.value = true
}

async function runPending() {
  if (!pending.value) return
  confirmBusy.value = true
  try {
    await pending.value.run()
    confirmOpen.value = false
    pending.value = null
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Action failed'
    confirmOpen.value = false
  } finally {
    confirmBusy.value = false
  }
}

// ─── Reason modal (reject, request-changes, unpublish) ───────────────────
type ReasonKind = 'reject' | 'request-changes' | 'unpublish'
const reasonOpen = ref(false)
const reasonBusy = ref(false)
const reasonKind = ref<ReasonKind | null>(null)
const reasonText = ref('')
const reasonError = ref('')

const reasonConfig = computed<{ title: string; placeholder: string; confirm: string } | null>(() => {
  switch (reasonKind.value) {
    case 'reject':
      return {
        title: 'Reject space',
        placeholder: 'Explain why this submission is rejected. Sent to the publisher.',
        confirm: 'Reject',
      }
    case 'request-changes':
      return {
        title: 'Request changes',
        placeholder: 'What needs to change before you can approve?',
        confirm: 'Request changes',
      }
    case 'unpublish':
      return {
        title: 'Unpublish space',
        placeholder: 'Optional reason, recorded in reviewer notes.',
        confirm: 'Unpublish',
      }
    default:
      return null
  }
})

function promptReason(kind: ReasonKind) {
  reasonKind.value = kind
  reasonText.value = ''
  reasonError.value = ''
  reasonOpen.value = true
}

async function submitReason() {
  if (!space.value || !reasonKind.value) return
  if ((reasonKind.value === 'reject' || reasonKind.value === 'request-changes') && !reasonText.value.trim()) {
    reasonError.value = 'Please provide a reason.'
    return
  }
  reasonBusy.value = true
  reasonError.value = ''
  try {
    const text = reasonText.value.trim()
    if (reasonKind.value === 'reject') await rejectSpace(space.value.id, text)
    else if (reasonKind.value === 'request-changes') await requestChangesSpace(space.value.id, text)
    else if (reasonKind.value === 'unpublish') await unpublishSpace(space.value.id, text || undefined)
    reasonOpen.value = false
    reasonKind.value = null
    await load()
  } catch (err) {
    reasonError.value = err instanceof Error ? err.message : 'Action failed'
  } finally {
    reasonBusy.value = false
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

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

function fmtBytes(n?: number): string {
  if (n === undefined || n === null || n < 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div v-if="loading" class="text-sm text-[var(--app-muted)]">Loading space…</div>
    <div v-else-if="error && !space" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <!-- Not submitted: graph row exists, developer doesn't. No review
         actions are available — the space hasn't entered the lifecycle.
         Delete cascades the graph orphan (schemas + manifests + spaces row)
         so admins don't have to bounce back to the list. -->
    <div v-else-if="notSubmitted" class="rounded-xl border border-dashed border-[var(--app-border)] p-8 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:archive" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">Not submitted to the marketplace</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        <span class="font-mono">{{ spaceId }}</span> has runtime presence on graph but was never published through <code class="font-mono">construct space publish</code>. No review actions are available until the publisher submits.
      </p>
      <div class="flex items-center justify-center gap-3 mt-5">
        <RouterLink
          to="/developer/spaces"
          class="inline-flex items-center gap-1.5 text-xs text-[var(--app-muted)] hover:text-[var(--app-foreground)]"
        >
          <Icon icon="lucide:arrow-left" class="size-3.5" />
          Back to all spaces
        </RouterLink>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-500/10"
          @click="orphanDeleteOpen = true"
        >
          <Icon icon="lucide:trash-2" class="size-3.5" />
          Delete from graph
        </button>
      </div>
      <p v-if="orphanDeleteError" class="text-xs text-red-500 mt-3">{{ orphanDeleteError }}</p>
    </div>

    <template v-else-if="space">
      <!-- Header -->
      <div class="flex items-center gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-5 py-4">
        <div class="size-12 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon :icon="`lucide:${space.icon || 'blocks'}`" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-semibold truncate">{{ space.display_name || space.name }}</h1>
            <Icon
              v-if="space.recommended"
              icon="lucide:star"
              class="size-4 text-amber-500 shrink-0"
              title="Recommended"
            />
          </div>
          <div class="text-xs text-[var(--app-muted)] font-mono truncate">
            {{ space.name }}<span v-if="space.version"> · v{{ space.version }}</span>
          </div>
        </div>
        <span v-if="space.status" class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0" :class="statusPill(space.status)">
          {{ space.status.replace('_', ' ') }}
        </span>
      </div>

      <div v-if="error && space" class="flex items-start gap-2 text-sm text-red-500" role="alert">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </div>

      <!-- Info + actions -->
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-2">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">SPACE</div>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt class="text-[var(--app-muted)]">Scope</dt>
            <dd>{{ space.scope || '—' }}</dd>
            <dt class="text-[var(--app-muted)]">Publisher</dt>
            <dd class="truncate">
              <RouterLink
                v-if="space.publisher_info"
                :to="`/developer/publishers/${space.publisher_info.id}`"
                class="hover:text-[var(--app-accent)] transition-colors"
              >
                {{ space.publisher_info.name }}
              </RouterLink>
              <span v-else>{{ space.publisher_name || '—' }}</span>
            </dd>
            <dt class="text-[var(--app-muted)]">Owner</dt>
            <dd>
              <span v-if="space.ownerOrgId" class="inline-flex items-center gap-1.5">
                <span class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--app-accent)]/10 text-[var(--app-accent)]">org</span>
                <code class="font-mono text-xs truncate">{{ space.ownerOrgId }}</code>
                <button
                  class="text-[var(--app-muted)] hover:text-[var(--app-foreground)]"
                  title="Copy UUID"
                  @click="copyText(space.ownerOrgId!)"
                >
                  <Icon icon="lucide:copy" class="size-3" />
                </button>
              </span>
              <span v-else-if="space.ownerUserId" class="inline-flex items-center gap-1.5">
                <span class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--app-muted)]/10 text-[var(--app-muted)]">user</span>
                <code class="font-mono text-xs truncate">{{ space.ownerUserId }}</code>
                <button
                  class="text-[var(--app-muted)] hover:text-[var(--app-foreground)]"
                  title="Copy UUID"
                  @click="copyText(space.ownerUserId!)"
                >
                  <Icon icon="lucide:copy" class="size-3" />
                </button>
              </span>
              <span v-else class="text-[var(--app-muted)]">—</span>
            </dd>
            <dt class="text-[var(--app-muted)]">Bundle size</dt>
            <dd>{{ fmtBytes(space.build_size) }}</dd>
            <dt class="text-[var(--app-muted)]">Reviewed at</dt>
            <dd>{{ fmtDate(space.reviewed_at) }}</dd>
            <dt class="text-[var(--app-muted)]">Updated</dt>
            <dd>{{ fmtDate(space.updated_at) }}</dd>
            <dt class="text-[var(--app-muted)]">Created</dt>
            <dd>{{ fmtDate(space.created_at) }}</dd>
          </dl>
          <div v-if="space.description" class="pt-2 border-t border-[var(--app-border)]">
            <div class="mono text-xs text-[var(--app-muted)] tracking-wider mb-1">DESCRIPTION</div>
            <p class="text-sm">{{ space.description }}</p>
          </div>
        </div>

        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">MODERATION</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="space.status !== 'approved'"
              class="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 text-emerald-600 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500/10"
              @click="promptAction({
                title: 'Approve space',
                message: `Approve ${space!.display_name || space!.name}? It becomes publicly visible on the marketplace.`,
                confirm: 'Approve',
                destructive: false,
                run: () => approveSpace(space!.id),
              })"
            >
              <Icon icon="lucide:check" class="size-3.5" />
              Approve
            </button>
            <button
              class="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 text-amber-600 px-3 py-1.5 text-xs font-medium hover:bg-amber-500/10"
              @click="promptReason('request-changes')"
            >
              <Icon icon="lucide:message-circle" class="size-3.5" />
              Request changes
            </button>
            <button
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]"
              @click="promptAction({
                title: space!.recommended ? 'Unfeature space' : 'Feature space',
                message: space!.recommended
                  ? `Remove ${space!.display_name || space!.name} from the recommended list?`
                  : `Add ${space!.display_name || space!.name} to the recommended list? It will be highlighted on the marketplace.`,
                confirm: space!.recommended ? 'Unfeature' : 'Feature',
                destructive: false,
                run: () => toggleRecommended(space!.id),
              })"
            >
              <Icon icon="lucide:star" class="size-3.5" />
              {{ space.recommended ? 'Unfeature' : 'Feature' }}
            </button>
            <button
              v-if="space.status !== 'rejected'"
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] text-red-500 px-3 py-1.5 text-xs font-medium hover:bg-red-500/10"
              @click="promptReason('reject')"
            >
              <Icon icon="lucide:x" class="size-3.5" />
              Reject
            </button>
            <button
              v-if="space.status === 'approved' || space.status === 'published'"
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] text-red-500 px-3 py-1.5 text-xs font-medium hover:bg-red-500/10"
              @click="promptReason('unpublish')"
            >
              <Icon icon="lucide:eye-off" class="size-3.5" />
              Unpublish
            </button>
            <button
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]"
              @click="downloadLatestSource"
            >
              <Icon icon="lucide:download" class="size-3.5" />
              Download source
            </button>
            <button
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]"
              @click="openEdit"
            >
              <Icon icon="lucide:pencil" class="size-3.5" />
              Edit
            </button>
            <button
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]"
              @click="openTransfer"
            >
              <Icon icon="lucide:arrow-right-left" class="size-3.5" />
              Transfer
            </button>
            <button
              class="inline-flex items-center gap-1.5 rounded-md border border-red-500/60 text-red-500 px-3 py-1.5 text-xs font-medium hover:bg-red-500/10"
              @click="openDelete"
            >
              <Icon icon="lucide:trash-2" class="size-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <!-- Reviewer notes (if any) -->
      <div v-if="space.reviewer_notes" class="flex flex-col gap-2">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">REVIEWER NOTES</div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 text-sm whitespace-pre-wrap">
          {{ space.reviewer_notes }}
        </div>
      </div>

      <!-- Publish history. Append-only audit; per-row source download
           lets reviewers compare prior versions when triaging a regression. -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">PUBLISH HISTORY</div>
          <span v-if="publishes.length" class="text-xs text-[var(--app-muted)]">{{ publishes.length }} publish{{ publishes.length === 1 ? '' : 'es' }}</span>
        </div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] overflow-hidden">
          <div v-if="publishesLoading" class="px-5 py-4 text-sm text-[var(--app-muted)]">Loading…</div>
          <div v-else-if="publishes.length === 0" class="px-5 py-4 text-sm text-[var(--app-muted)]">
            No history recorded yet. Spaces published before the audit table existed won't appear here.
          </div>
          <div
            v-else
            v-for="(p, i) in publishes"
            :key="p.id"
            class="flex items-start gap-3 px-5 py-3"
            :class="i > 0 ? 'border-t border-[var(--app-border)]' : ''"
          >
            <div class="size-8 rounded-md grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
              <Icon icon="lucide:package" class="size-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 text-sm">
                <span class="font-medium font-mono">v{{ p.version }}</span>
                <span class="text-[var(--app-muted)]">·</span>
                <span class="text-[var(--app-muted)]">{{ fmtDate(p.publishedAt) }}</span>
              </div>
              <div class="text-xs text-[var(--app-muted)] mt-0.5 truncate">
                <template v-if="p.publisher">
                  by <span class="text-[var(--app-foreground)]">{{ p.publisher.name }}</span>
                  <span class="font-mono"> &lt;{{ p.publisher.email }}&gt;</span>
                </template>
                <template v-else>
                  by <span class="font-mono">{{ p.publisherUserId.slice(0, 8) }}…</span>
                </template>
                <span v-if="p.ownerOrgId"> · org-owned</span>
                <span v-else-if="p.ownerUserId"> · personal</span>
              </div>
              <div class="text-xs text-[var(--app-muted)] mt-0.5">
                {{ fmtBytes(p.buildSize) }}<span v-if="p.buildDuration"> · built in {{ p.buildDuration }}</span>
              </div>
            </div>
            <button
              v-if="p.hasSource"
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--app-card-hover)] shrink-0"
              @click="downloadPublishSource(p)"
            >
              <Icon icon="lucide:download" class="size-3.5" />
              Source
            </button>
          </div>
        </div>
      </div>
    </template>

    <ConfirmationModal
      v-model="confirmOpen"
      :title="pending?.title ?? 'Confirm'"
      :message="pending?.message ?? ''"
      :confirm-text="pending?.confirm ?? 'Confirm'"
      :confirm-color="pending?.destructive ? 'error' : 'primary'"
      :loading="confirmBusy"
      @confirm="runPending"
    />

    <ConfirmationModal
      v-model="orphanDeleteOpen"
      title="Delete from graph"
      :message="`Drop every schema, manifest, and registry row for ${spaceId}? This cannot be undone — installed tenants will lose runtime data.`"
      confirm-text="Delete"
      confirm-color="error"
      :loading="orphanDeleteBusy"
      @confirm="runOrphanDelete"
    />

    <Modal v-model:open="reasonOpen">
      <template #header>
        <h3 class="text-lg font-semibold">{{ reasonConfig?.title ?? 'Reason' }}</h3>
      </template>
      <template #body>
        <form class="flex flex-col gap-3" @submit.prevent="submitReason">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Reason{{ reasonKind === 'unpublish' ? ' (optional)' : ' *' }}</span>
            <textarea
              v-model="reasonText"
              rows="4"
              :placeholder="reasonConfig?.placeholder ?? ''"
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] resize-none"
            />
          </label>
          <p v-if="reasonError" class="text-xs text-red-500">{{ reasonError }}</p>
        </form>
      </template>
      <template #footer>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]"
            :disabled="reasonBusy"
            @click="reasonOpen = false"
          >Cancel</button>
          <button
            type="button"
            class="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            :disabled="reasonBusy"
            @click="submitReason"
          >{{ reasonBusy ? 'Submitting…' : (reasonConfig?.confirm ?? 'Submit') }}</button>
        </div>
      </template>
    </Modal>

    <!-- Edit metadata -->
    <Modal v-model:open="editOpen">
      <template #header>
        <h3 class="text-lg font-semibold">Edit space</h3>
      </template>
      <template #body>
        <form class="flex flex-col gap-3" @submit.prevent="submitEdit">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Display name</span>
            <input
              v-model="editForm.display_name"
              type="text"
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Description</span>
            <textarea
              v-model="editForm.description"
              rows="3"
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] resize-none"
            />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-xs text-[var(--app-muted)]">Icon (Lucide)</span>
              <input
                v-model="editForm.icon"
                type="text"
                placeholder="e.g. blocks"
                class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-[var(--app-muted)]">Scope</span>
              <input
                v-model="editForm.scope"
                type="text"
                placeholder="e.g. app | project"
                class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
              />
            </label>
          </div>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Author</span>
            <input
              v-model="editForm.author"
              type="text"
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
            />
          </label>
          <p v-if="editError" class="text-xs text-red-500">{{ editError }}</p>
        </form>
      </template>
      <template #footer>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]"
            :disabled="editBusy"
            @click="editOpen = false"
          >Cancel</button>
          <button
            type="button"
            class="rounded-md bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            :disabled="editBusy"
            @click="submitEdit"
          >{{ editBusy ? 'Saving…' : 'Save' }}</button>
        </div>
      </template>
    </Modal>

    <!-- Hard-delete with type-to-confirm -->
    <Modal v-model:open="deleteOpen">
      <template #header>
        <h3 class="text-lg font-semibold text-red-500">Delete space</h3>
      </template>
      <template #body>
        <form class="flex flex-col gap-3" @submit.prevent="submitDelete">
          <p class="text-sm">
            This permanently removes <code class="font-mono">{{ space?.name }}</code> from the registry.
            Installs and bundles are not purged — those belong to other services.
          </p>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">
              Type the space name to confirm: <code class="font-mono text-[var(--app-foreground)]">{{ space?.name }}</code>
            </span>
            <input
              v-model="deleteTyped"
              type="text"
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-red-500"
            />
          </label>
          <p v-if="deleteError" class="text-xs text-red-500">{{ deleteError }}</p>
        </form>
      </template>
      <template #footer>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]"
            :disabled="deleteBusy"
            @click="deleteOpen = false"
          >Cancel</button>
          <button
            type="button"
            class="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            :disabled="deleteBusy || !deleteMatches"
            @click="submitDelete"
          >{{ deleteBusy ? 'Deleting…' : 'Delete permanently' }}</button>
        </div>
      </template>
    </Modal>

    <Modal v-model:open="transferOpen">
      <template #header>
        <h3 class="text-lg font-semibold">Transfer space</h3>
      </template>
      <template #body>
        <form class="flex flex-col gap-3" @submit.prevent="submitTransfer">
          <p class="text-sm text-[var(--app-muted)]">
            Admin override: directly rewrites ownership for <code class="font-mono">{{ space?.name }}</code>. Skips owner-initiated propose/accept and the 7-day re-transfer lock.
          </p>
          <fieldset class="flex gap-4 text-sm">
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <input v-model="transferKind" type="radio" value="org" />
              Organization
            </label>
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <input v-model="transferKind" type="radio" value="user" />
              User
            </label>
          </fieldset>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">
              Target {{ transferKind === 'org' ? 'organization' : 'user' }} UUID
            </span>
            <input
              v-model="transferUuid"
              type="text"
              placeholder="00000000-0000-0000-0000-000000000000"
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--app-accent)]"
            />
          </label>
          <p v-if="transferError" class="text-xs text-red-500">{{ transferError }}</p>
        </form>
      </template>
      <template #footer>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]"
            :disabled="transferBusy"
            @click="transferOpen = false"
          >Cancel</button>
          <button
            type="button"
            class="rounded-md bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            :disabled="transferBusy || !transferUuid.trim()"
            @click="submitTransfer"
          >{{ transferBusy ? 'Transferring…' : 'Transfer' }}</button>
        </div>
      </template>
    </Modal>
  </section>
</template>
