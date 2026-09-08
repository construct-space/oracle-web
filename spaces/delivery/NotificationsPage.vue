<script setup lang="ts">
/**
 * Delivery → Notifications (oracle staff view).
 *
 * Three things on one page:
 *   • Stats strip — totals, last-24h volume, push-surface inventory.
 *   • Filterable list — paginated rows across all users, with user_id,
 *     source, type, and unread filters.
 *   • Test composer (modal) — emit a notification through the same fanout
 *     path as /internal/notify, so support can verify a user's surfaces
 *     are wired correctly. Audited as notification.test_send.
 */
import { Pagination, Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import {
  type AdminNotification,
  type ListNotificationsParams,
  type NotificationStatsResponse,
  type SendTestNotificationInput,
  getNotificationStats,
  listNotifications,
  sendTestNotification,
} from './api'

// ─── Stats ────────────────────────────────────────────────────────────────
const stats = ref<NotificationStatsResponse | null>(null)
const statsLoading = ref(false)
const statsError = ref('')

async function loadStats() {
  statsLoading.value = true
  statsError.value = ''
  try {
    stats.value = await getNotificationStats()
  } catch (e) {
    statsError.value = e instanceof Error ? e.message : 'Failed to load stats'
  } finally {
    statsLoading.value = false
  }
}

// ─── List ────────────────────────────────────────────────────────────────
const rows = ref<AdminNotification[]>([])
const total = ref(0)
const listLoading = ref(false)
const listError = ref('')

const userFilter = ref('')
const sourceFilter = ref('')
const typeFilter = ref('')
const unreadOnly = ref(false)
const page = ref(1)
const pageSize = ref(25)

let userTimer: ReturnType<typeof setTimeout> | null = null
let typeTimer: ReturnType<typeof setTimeout> | null = null
let reqSeq = 0

async function loadList() {
  const mySeq = ++reqSeq
  listLoading.value = true
  listError.value = ''
  const params: ListNotificationsParams = { page: page.value, limit: pageSize.value }
  if (userFilter.value.trim()) params.user_id = userFilter.value.trim()
  if (sourceFilter.value) params.source = sourceFilter.value
  if (typeFilter.value.trim()) params.type = typeFilter.value.trim()
  if (unreadOnly.value) params.unread = true
  try {
    const res = await listNotifications(params)
    if (mySeq !== reqSeq) return
    rows.value = res.data
    total.value = res.total
  } catch (e) {
    if (mySeq !== reqSeq) return
    listError.value = e instanceof Error ? e.message : 'Failed to load'
  } finally {
    if (mySeq === reqSeq) listLoading.value = false
  }
}

const rangeLabel = computed(() => {
  if (!total.value) return '0'
  const start = (page.value - 1) * pageSize.value + 1
  const end = Math.min(start + pageSize.value - 1, total.value)
  return `${start}–${end} of ${total.value}`
})

watch(userFilter, () => {
  page.value = 1
  if (userTimer) clearTimeout(userTimer)
  userTimer = setTimeout(loadList, 300)
})
watch(sourceFilter, () => { page.value = 1; loadList() })
watch(typeFilter, () => {
  page.value = 1
  if (typeTimer) clearTimeout(typeTimer)
  typeTimer = setTimeout(loadList, 300)
})
watch(unreadOnly, () => { page.value = 1; loadList() })
watch(page, loadList)

// ─── Test composer ───────────────────────────────────────────────────────
const composerOpen = ref(false)
const draft = ref<SendTestNotificationInput>({
  user_id: '',
  title: '',
  body: '',
  link: '',
  source: 'oracle',
  type: 'test.message',
})
const sending = ref(false)
const sendError = ref('')
const sendOk = ref(false)

function openComposer() {
  draft.value = { user_id: '', title: '', body: '', link: '', source: 'oracle', type: 'test.message' }
  sendError.value = ''
  sendOk.value = false
  composerOpen.value = true
}
function closeComposer() {
  composerOpen.value = false
}
async function submitTest() {
  sendError.value = ''
  sendOk.value = false
  if (!draft.value.user_id.trim() || !draft.value.title.trim()) {
    sendError.value = 'user_id and title are required'
    return
  }
  sending.value = true
  try {
    await sendTestNotification(draft.value)
    sendOk.value = true
    // Refresh both surfaces so the operator sees the row appear.
    await Promise.all([loadStats(), loadList()])
    setTimeout(closeComposer, 800)
  } catch (e) {
    sendError.value = e instanceof Error ? e.message : 'Failed to send'
  } finally {
    sending.value = false
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────
function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function relTime(iso: string): string {
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return ''
  const diff = Math.max(0, Date.now() - d)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

onMounted(() => {
  loadStats()
  loadList()
})
</script>

<template>
  <section class="max-w-6xl flex flex-col gap-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Notifications</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Cross-user feed of every notification delivery has emitted, plus push surface inventory and a test composer.
        </p>
      </div>
      <button
        class="px-3 py-1.5 text-sm rounded-md border border-[var(--app-border)] hover:bg-[var(--app-card-hover)] transition-colors flex items-center gap-2"
        @click="openComposer"
      >
        <Icon icon="lucide:send" class="size-4" />
        Send test
      </button>
    </div>

    <!-- Stats -->
    <div v-if="statsError" class="text-sm text-red-500">{{ statsError }}</div>
    <div v-if="statsLoading && !stats" class="text-sm text-[var(--app-muted)]">Loading stats…</div>
    <template v-else-if="stats">
      <div class="grid gap-4 md:grid-cols-4">
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">TOTAL</div>
          <div class="text-2xl font-semibold mt-1">{{ stats.total.toLocaleString() }}</div>
          <div class="text-xs text-[var(--app-muted)] mt-1">{{ stats.unread.toLocaleString() }} unread · {{ stats.read.toLocaleString() }} read</div>
        </div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">LAST 24H</div>
          <div class="text-2xl font-semibold mt-1">{{ stats.last_24h.toLocaleString() }}</div>
          <div class="text-xs text-[var(--app-muted)] mt-1">notifications emitted</div>
        </div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">WEB PUSH</div>
          <div class="text-2xl font-semibold mt-1">{{ stats.push_surfaces.web_subscriptions.toLocaleString() }}</div>
          <div class="text-xs text-[var(--app-muted)] mt-1">browser subscriptions</div>
        </div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">MOBILE</div>
          <div class="text-2xl font-semibold mt-1">{{ stats.push_surfaces.device_tokens.toLocaleString() }}</div>
          <div class="text-xs text-[var(--app-muted)] mt-1">{{ stats.push_surfaces.ios }} iOS · {{ stats.push_surfaces.android }} Android</div>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider mb-3">BY SOURCE</div>
          <div v-if="!stats.by_source.length" class="text-sm text-[var(--app-muted)]">No data yet.</div>
          <ul v-else class="flex flex-col gap-2">
            <li v-for="b in stats.by_source" :key="b.key" class="flex items-center justify-between text-sm">
              <span class="font-medium">{{ b.key }}</span>
              <span class="text-[var(--app-muted)]">{{ b.count.toLocaleString() }}</span>
            </li>
          </ul>
        </div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider mb-3">BY TYPE</div>
          <div v-if="!stats.by_type.length" class="text-sm text-[var(--app-muted)]">No data yet.</div>
          <ul v-else class="flex flex-col gap-2">
            <li v-for="b in stats.by_type" :key="b.key" class="flex items-center justify-between text-sm">
              <span class="font-medium">{{ b.key }}</span>
              <span class="text-[var(--app-muted)]">{{ b.count.toLocaleString() }}</span>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <input
        v-model="userFilter"
        placeholder="user_id"
        class="px-3 py-1.5 text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] w-56"
      />
      <input
        v-model="typeFilter"
        placeholder="type (e.g. transfer.requested)"
        class="px-3 py-1.5 text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] w-72"
      />
      <select
        v-model="sourceFilter"
        class="px-3 py-1.5 text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)]"
      >
        <option value="">All sources</option>
        <option value="accounts">accounts</option>
        <option value="source">source</option>
        <option value="developer">developer</option>
        <option value="billing">billing</option>
        <option value="oracle">oracle</option>
      </select>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="unreadOnly" type="checkbox" class="accent-[var(--app-accent)]" />
        Unread only
      </label>
      <div class="flex-1" />
      <span class="text-xs text-[var(--app-muted)]">{{ rangeLabel }}</span>
    </div>

    <!-- List -->
    <div v-if="listError" class="text-sm text-red-500">{{ listError }}</div>
    <div v-if="listLoading && !rows.length" class="text-sm text-[var(--app-muted)]">Loading…</div>
    <div v-else class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] overflow-hidden">
      <table class="w-full text-sm">
        <thead class="text-xs text-[var(--app-muted)] bg-[var(--app-surface)]">
          <tr>
            <th class="text-left px-4 py-2 font-medium">When</th>
            <th class="text-left px-4 py-2 font-medium">User</th>
            <th class="text-left px-4 py-2 font-medium">Source / Type</th>
            <th class="text-left px-4 py-2 font-medium">Title</th>
            <th class="text-left px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--app-border)]">
          <tr v-for="n in rows" :key="n.id" class="hover:bg-[var(--app-card-hover)]">
            <td class="px-4 py-3 whitespace-nowrap text-xs">
              <div>{{ relTime(n.created_at) }}</div>
              <div class="text-[10px] text-[var(--app-muted)]">{{ fmtDateTime(n.created_at) }}</div>
            </td>
            <td class="px-4 py-3 font-mono text-xs">{{ (n as { user_id?: string }).user_id ?? '—' }}</td>
            <td class="px-4 py-3 text-xs">
              <div class="font-medium">{{ n.source }}</div>
              <div class="text-[var(--app-muted)]">{{ n.type }}</div>
            </td>
            <td class="px-4 py-3">
              <div class="font-medium truncate max-w-md">{{ n.title }}</div>
              <div v-if="n.body" class="text-xs text-[var(--app-muted)] truncate max-w-md">{{ n.body }}</div>
            </td>
            <td class="px-4 py-3">
              <span
                v-if="n.read_at"
                class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)]"
              >read</span>
              <span
                v-else
                class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600"
              >unread</span>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="5" class="px-4 py-10 text-center text-sm text-[var(--app-muted)]">
              No notifications match these filters.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Pagination
      v-if="total > pageSize"
      :total="total"
      :model-value="page"
      :page-size="pageSize"
      @update:model-value="(v: number) => (page = v)"
    />

    <!-- Test composer -->
    <div
      v-if="composerOpen"
      class="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm"
      @click.self="closeComposer"
    >
      <div class="w-[480px] max-w-[92vw] rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] shadow-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-[var(--app-border)] flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold">Send test notification</h2>
            <p class="text-xs text-[var(--app-muted)] mt-0.5">Audited as <code>notification.test_send</code>.</p>
          </div>
          <button class="size-8 grid place-items-center text-[var(--app-muted)] hover:text-[var(--app-foreground)]" @click="closeComposer">
            <Icon icon="lucide:x" class="size-4" />
          </button>
        </div>

        <form class="px-5 py-4 flex flex-col gap-3" @submit.prevent="submitTest">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">User ID</span>
            <input
              v-model="draft.user_id"
              required
              class="px-3 py-1.5 text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] font-mono"
              placeholder="UUID"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Title</span>
            <input
              v-model="draft.title"
              required
              class="px-3 py-1.5 text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-surface)]"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Body</span>
            <textarea
              v-model="draft.body"
              rows="3"
              class="px-3 py-1.5 text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] resize-none"
            />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-xs text-[var(--app-muted)]">Source</span>
              <input
                v-model="draft.source"
                class="px-3 py-1.5 text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-surface)]"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-[var(--app-muted)]">Type</span>
              <input
                v-model="draft.type"
                class="px-3 py-1.5 text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-surface)]"
              />
            </label>
          </div>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Link (optional)</span>
            <input
              v-model="draft.link"
              class="px-3 py-1.5 text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-surface)]"
              placeholder="/some/deep/link"
            />
          </label>

          <div v-if="sendError" class="text-sm text-red-500">{{ sendError }}</div>
          <div v-if="sendOk" class="text-sm text-emerald-600">Sent.</div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              class="px-3 py-1.5 text-sm rounded-md border border-[var(--app-border)] hover:bg-[var(--app-card-hover)]"
              @click="closeComposer"
            >Cancel</button>
            <button
              type="submit"
              :disabled="sending"
              class="px-3 py-1.5 text-sm rounded-md bg-[var(--app-accent)] text-white hover:opacity-90 disabled:opacity-50"
            >
              {{ sending ? 'Sending…' : 'Send' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
