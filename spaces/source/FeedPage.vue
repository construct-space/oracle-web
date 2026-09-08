<script setup lang="ts">
/**
 * Feed admin — edit the blocks shown on the construct-app home page top
 * strip (see frontend/components/home/BuiltinWidgets.vue + FeedBlock.vue).
 *
 * Read list → inline edit drawer → POST/PATCH/DELETE via oracle-api →
 * source-api persists. The home page GET /api/feed falls back to a
 * hardcoded seed if the table is empty, so first-time-empty is safe.
 */
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, reactive, ref } from 'vue'
import {
  createFeedItem,
  deleteFeedItem,
  type FeedBlockType,
  type FeedItem,
  type FeedItemInput,
  listFeedItems,
  reorderFeedItems,
  updateFeedItem,
} from './api'

const items = ref<FeedItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// Drawer state: null = closed, 'new' = create, item = edit-existing.
const editing = ref<FeedItem | 'new' | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)

// Form buffer used by both create + edit so the template stays single.
// Wrapped in reactive() so nested arrays (items[]) respond to mutations.
const form = reactive<FeedItemInput>(emptyForm())

function emptyForm(): FeedItemInput {
  return {
    type: 'tip',
    label: '',
    title: '',
    body: '',
    route: '',
    url: '',
    icon: '',
    items: [],
    cols: 3,
    position: 0,
    active: true,
  }
}

const TYPE_OPTIONS: { value: FeedBlockType; label: string; hint: string }[] = [
  { value: 'action', label: 'Action', hint: 'Shortcut card — label + body + route/url' },
  { value: 'announcement', label: 'Announcement', hint: 'Kicker + title + body' },
  { value: 'changelog', label: 'Changelog', hint: 'Kicker + title + bullet items' },
  { value: 'tip', label: 'Tip', hint: 'Kicker + title + body' },
  { value: 'update', label: 'Update', hint: 'Kicker + title + body' },
  { value: 'info', label: 'Info', hint: 'Fallback — title or body' },
]

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await listFeedItems()
    items.value = res.items
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(form, emptyForm())
  editing.value = 'new'
  saveError.value = null
}

function openEdit(item: FeedItem) {
  Object.assign(form, {
    type: item.type,
    label: item.label ?? '',
    title: item.title ?? '',
    body: item.body ?? '',
    route: item.route ?? '',
    url: item.url ?? '',
    icon: item.icon ?? '',
    items: [...(item.items || [])],
    cols: item.cols,
    position: item.position,
    active: item.active,
  })
  editing.value = item
  saveError.value = null
}

function closeDrawer() {
  editing.value = null
}

async function save() {
  if (!form.type) {
    saveError.value = 'Type is required'
    return
  }
  saving.value = true
  saveError.value = null
  try {
    // Drop empty string fields — server treats "" as a set-to-empty, which
    // is fine, but keeping the payload minimal makes the diff cleaner.
    const payload: FeedItemInput = { ...form }
    payload.items = payload.items.filter((s) => s.trim().length > 0)
    if (editing.value === 'new') {
      await createFeedItem(payload)
    } else if (editing.value) {
      await updateFeedItem(editing.value.id, payload)
    }
    editing.value = null
    await load()
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

async function remove(item: FeedItem) {
  if (!window.confirm(`Delete "${item.title || item.label || item.type}"?`)) return
  try {
    await deleteFeedItem(item.id)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function move(item: FeedItem, direction: -1 | 1) {
  const idx = items.value.findIndex((it) => it.id === item.id)
  const swapIdx = idx + direction
  if (idx < 0 || swapIdx < 0 || swapIdx >= items.value.length) return
  // Optimistic reorder so the list doesn't jitter while the server
  // round-trip happens. Failure reloads to server truth.
  const reordered = [...items.value]
  ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]
  items.value = reordered
  try {
    await reorderFeedItems(reordered.map((r) => r.id))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    await load()
  }
}

function addBulletRow() {
  form.items.push('')
}

function removeBulletRow(i: number) {
  form.items.splice(i, 1)
}

// Summary string for the row's body column — title if present, else body,
// else label. Keeps the list dense without a second line per row.
function rowSummary(item: FeedItem): string {
  return item.title || item.body || item.label || '—'
}

const drawerTitle = computed(() => (editing.value === 'new' ? 'New feed item' : 'Edit feed item'))

onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Feed</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Content blocks shown on the construct-app home page top strip. Changes go live immediately —
          the desktop app fetches <code class="font-mono text-xs">/api/feed</code> on boot.
        </p>
      </div>
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white"
        @click="openCreate"
      >
        <Icon icon="lucide:plus" class="size-3.5" />
        New item
      </button>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !items.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <!-- Items list -->
    <div
      v-else-if="items.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <div
        v-for="(item, i) in items"
        :key="item.id"
        class="flex items-center gap-4 px-5 py-3.5"
        :class="{ 'opacity-50': !item.active }"
      >
        <div class="flex flex-col gap-0.5 shrink-0">
          <button
            :disabled="i === 0"
            class="size-5 inline-flex items-center justify-center rounded text-[var(--app-muted)] hover:bg-[var(--app-card-hover)] disabled:opacity-25 disabled:cursor-not-allowed"
            title="Move up"
            @click="move(item, -1)"
          >
            <Icon icon="lucide:chevron-up" class="size-3" />
          </button>
          <button
            :disabled="i === items.length - 1"
            class="size-5 inline-flex items-center justify-center rounded text-[var(--app-muted)] hover:bg-[var(--app-card-hover)] disabled:opacity-25 disabled:cursor-not-allowed"
            title="Move down"
            @click="move(item, 1)"
          >
            <Icon icon="lucide:chevron-down" class="size-3" />
          </button>
        </div>

        <div class="flex-1 min-w-0 flex items-center gap-3">
          <span
            class="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
            :class="item.active
              ? 'bg-[var(--app-accent)]/15 text-[var(--app-accent)]'
              : 'bg-[var(--app-surface)] text-[var(--app-muted)]'"
          >
            {{ item.type }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium truncate">{{ rowSummary(item) }}</div>
            <div v-if="item.title && item.body" class="text-xs text-[var(--app-muted)] truncate">{{ item.body }}</div>
          </div>
        </div>

        <div class="hidden md:flex items-center gap-4 text-xs text-[var(--app-muted)] shrink-0">
          <span>cols <strong class="text-[var(--app-foreground)]">{{ item.cols }}</strong></span>
          <span v-if="!item.active" class="text-amber-500">hidden</span>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <button
            class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--app-muted)] hover:bg-[var(--app-card-hover)] hover:text-[var(--app-foreground)]"
            @click="openEdit(item)"
          >
            <Icon icon="lucide:pencil" class="size-3" />
            Edit
          </button>
          <button
            class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--app-muted)] hover:bg-red-500/10 hover:text-red-500"
            @click="remove(item)"
          >
            <Icon icon="lucide:trash-2" class="size-3" />
          </button>
        </div>
      </div>
    </div>

    <div
      v-else-if="!loading"
      class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center"
    >
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:layout-dashboard" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">
        No feed items yet — the app shows the built-in seed layout.
      </div>
      <p class="text-xs text-[var(--app-muted)] mt-1">
        Add your first item above to start controlling the home strip.
      </p>
    </div>

    <!-- Edit drawer -->
    <div
      v-if="editing"
      class="fixed inset-0 z-40 flex justify-end"
      @click.self="closeDrawer"
    >
      <div class="absolute inset-0 bg-black/30" />
      <div class="relative w-full max-w-md h-full bg-[var(--app-background)] border-l border-[var(--app-border)] shadow-xl flex flex-col">
        <div class="flex items-center justify-between px-5 py-4 border-b border-[var(--app-border)]">
          <h2 class="text-sm font-semibold">{{ drawerTitle }}</h2>
          <button
            class="size-7 rounded-md inline-flex items-center justify-center text-[var(--app-muted)] hover:bg-[var(--app-card-hover)]"
            @click="closeDrawer"
          >
            <Icon icon="lucide:x" class="size-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-[var(--app-muted)]">Type</span>
            <select
              v-model="form.type"
              class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm"
            >
              <option v-for="t in TYPE_OPTIONS" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
            <span class="text-[11px] text-[var(--app-muted)]">
              {{ TYPE_OPTIONS.find((t) => t.value === form.type)?.hint }}
            </span>
          </label>

          <label v-if="form.type === 'action'" class="flex flex-col gap-1">
            <span class="text-xs font-medium text-[var(--app-muted)]">Label</span>
            <input
              v-model="form.label"
              type="text"
              placeholder="e.g. Projects"
              class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm"
            />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-[var(--app-muted)]">Title</span>
            <input
              v-model="form.title"
              type="text"
              placeholder="e.g. What's New"
              class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm"
            />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-[var(--app-muted)]">Body</span>
            <textarea
              v-model="form.body"
              rows="3"
              class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm"
            />
          </label>

          <!-- Changelog-only bullet list -->
          <div v-if="form.type === 'changelog'" class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-[var(--app-muted)]">Bullet items</span>
              <button
                class="inline-flex items-center gap-1 text-xs text-[var(--app-accent)] hover:underline"
                @click="addBulletRow"
              >
                <Icon icon="lucide:plus" class="size-3" />
                Add
              </button>
            </div>
            <div
              v-for="(row, i) in form.items"
              :key="i"
              class="flex items-center gap-2"
            >
              <input
                v-model="form.items[i]"
                type="text"
                placeholder="Bullet text"
                class="flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm"
              />
              <button
                class="size-7 rounded-md inline-flex items-center justify-center text-[var(--app-muted)] hover:bg-red-500/10 hover:text-red-500"
                @click="removeBulletRow(i)"
              >
                <Icon icon="lucide:x" class="size-3.5" />
              </button>
            </div>
            <p v-if="!form.items.length" class="text-[11px] text-[var(--app-muted)]">No bullets yet — add up to 3 for the home strip.</p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-xs font-medium text-[var(--app-muted)]">Icon (Lucide)</span>
              <input
                v-model="form.icon"
                type="text"
                placeholder="e.g. zap"
                class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs font-medium text-[var(--app-muted)]">Columns (1–9)</span>
              <input
                v-model.number="form.cols"
                type="number"
                min="1"
                max="9"
                class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label v-if="form.type === 'action'" class="flex flex-col gap-1">
            <span class="text-xs font-medium text-[var(--app-muted)]">Route (in-app)</span>
            <input
              v-model="form.route"
              type="text"
              placeholder="e.g. /app/projects"
              class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm"
            />
          </label>

          <label v-if="form.type === 'action'" class="flex flex-col gap-1">
            <span class="text-xs font-medium text-[var(--app-muted)]">URL (external)</span>
            <input
              v-model="form.url"
              type="text"
              placeholder="https://…"
              class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm"
            />
          </label>

          <label class="flex items-center gap-2">
            <input v-model="form.active" type="checkbox" class="size-4 accent-[var(--app-accent)]" />
            <span class="text-sm">Active — visible on the home page</span>
          </label>
        </div>

        <div class="flex items-center justify-between px-5 py-4 border-t border-[var(--app-border)]">
          <p v-if="saveError" class="text-xs text-red-500">{{ saveError }}</p>
          <span v-else />
          <div class="flex items-center gap-2">
            <button
              class="text-xs px-3 py-1.5 rounded-md text-[var(--app-muted)] hover:bg-[var(--app-card-hover)]"
              @click="closeDrawer"
            >
              Cancel
            </button>
            <button
              :disabled="saving"
              class="inline-flex items-center gap-1.5 rounded-md bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              @click="save"
            >
              <Icon v-if="saving" icon="lucide:loader-2" class="size-3.5 animate-spin" />
              <Icon v-else icon="lucide:check" class="size-3.5" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
