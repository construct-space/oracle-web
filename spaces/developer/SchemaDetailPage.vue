<script setup lang="ts">
/**
 * Schema detail — graph-side, not marketplace.
 *
 * Shows the provisioned schema's metadata + every model (table) defined by
 * the owning space. Lets the admin drop the whole schema, browse rows of
 * any individual table, and export a table as CSV.
 *
 * Routed at /developer/graph/{schemaName}. The list of schemas is fetched
 * once to resolve the row's owning space_id (needed to fetch models — the
 * models endpoint is keyed by space_id, not schema name).
 */
import { ConfirmationModal } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  deleteGraphSchema,
  getGraphModels,
  getGraphTableRows,
  type GraphModel,
  type GraphSchemaRow,
  listGraphSchemas,
} from './api'

const route = useRoute()
const router = useRouter()

const schemaName = computed(() => decodeURIComponent(String(route.params.name || '')))

const loading = ref(false)
const error = ref('')
const schema = ref<GraphSchemaRow | null>(null)
const models = ref<GraphModel[]>([])

async function load() {
  if (!schemaName.value) return
  loading.value = true
  error.value = ''
  schema.value = null
  models.value = []
  expanded.clear()
  tableData.clear()
  try {
    const list = await listGraphSchemas()
    const found = (list.schemas || []).find((s) => s.schema_name === schemaName.value)
    if (!found) {
      error.value = `Schema "${schemaName.value}" not found.`
      return
    }
    schema.value = found

    const m = await getGraphModels(found.space_id)
    models.value = m.models || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load schema'
  } finally {
    loading.value = false
  }
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function fieldTypeLabel(f: GraphModel['fields'][number]): string {
  if (f.type === 'relation') {
    return `→ ${f.target || '?'}${f.relation ? ` (${f.relation})` : ''}`
  }
  if (f.type === 'enum') {
    const vals = (f.values || []).slice(0, 3).join(', ')
    return `enum${vals ? ` [${vals}${(f.values?.length || 0) > 3 ? '…' : ''}]` : ''}`
  }
  return f.type
}

// ─── Per-table data state ────────────────────────────────────────────────
//
// Each model gets a lazy slice of rows once the user expands it. State is
// keyed by model name; we don't refetch when collapsing/re-expanding. The
// page-size mirrors graph's server-side cap (200) to keep round trips
// minimal.
interface TableState {
  rows: Record<string, unknown>[]
  columns: string[]
  total: number
  offset: number
  limit: number
  busy: boolean
  error: string
  exporting: boolean
}

const PAGE_SIZE = 50
const expanded = reactive(new Set<string>())
const tableData = reactive(new Map<string, TableState>())

function ensureState(name: string): TableState {
  let st = tableData.get(name)
  if (!st) {
    st = {
      rows: [],
      columns: [],
      total: 0,
      offset: 0,
      limit: PAGE_SIZE,
      busy: false,
      error: '',
      exporting: false,
    }
    tableData.set(name, st)
  }
  return st
}

async function loadPage(name: string, offset: number) {
  if (!schema.value) return
  const st = ensureState(name)
  st.busy = true
  st.error = ''
  try {
    const r = await getGraphTableRows(schema.value.schema_name, name, {
      limit: PAGE_SIZE,
      offset,
    })
    st.rows = r.rows
    st.columns = r.columns
    st.total = r.total
    st.offset = r.offset
    st.limit = r.limit
  } catch (err) {
    st.error = err instanceof Error ? err.message : 'Failed to load rows'
  } finally {
    st.busy = false
  }
}

function toggle(name: string) {
  if (expanded.has(name)) {
    expanded.delete(name)
    return
  }
  expanded.add(name)
  const st = ensureState(name)
  // Lazy-load on first expand. Re-expanding shows what we already had.
  if (st.columns.length === 0 && !st.busy) {
    loadPage(name, 0)
  }
}

function nextPage(name: string) {
  const st = tableData.get(name)
  if (!st || st.busy) return
  if (st.offset + st.rows.length >= st.total) return
  loadPage(name, st.offset + st.limit)
}

function prevPage(name: string) {
  const st = tableData.get(name)
  if (!st || st.busy) return
  loadPage(name, Math.max(0, st.offset - st.limit))
}

function pageLabel(st: TableState | undefined): string {
  if (!st || st.total === 0) return '0'
  const end = Math.min(st.offset + st.rows.length, st.total)
  return `${st.offset + 1}–${end} of ${st.total}`
}

// Render any cell value as a compact string for the data grid. Objects /
// arrays get JSON.stringify'd; null becomes a visible em dash. Truncation
// happens in CSS (`truncate`) so the underlying string still copies in
// full.
function cellText(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

// ─── CSV export ──────────────────────────────────────────────────────────
//
// Pages through every row of the table client-side and assembles a CSV.
// A safety cap stops at 10k rows so a runaway export doesn't lock the
// browser; bigger tables would need a streaming server-side export.
const EXPORT_CAP = 10000

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s =
    typeof v === 'object'
      ? (() => {
          try {
            return JSON.stringify(v)
          } catch {
            return String(v)
          }
        })()
      : String(v)
  // RFC 4180: quote if contains comma, quote, or newline; double internal quotes
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

async function exportTable(name: string) {
  if (!schema.value) return
  const st = ensureState(name)
  st.exporting = true
  st.error = ''
  try {
    // First page seeds the columns + total.
    let r = await getGraphTableRows(schema.value.schema_name, name, {
      limit: 200,
      offset: 0,
    })
    const columns = r.columns
    const all: Record<string, unknown>[] = [...r.rows]
    while (all.length < r.total && all.length < EXPORT_CAP) {
      r = await getGraphTableRows(schema.value.schema_name, name, {
        limit: 200,
        offset: all.length,
      })
      if (r.rows.length === 0) break
      all.push(...r.rows)
    }

    const lines = [columns.map(csvEscape).join(',')]
    for (const row of all) {
      lines.push(columns.map((c) => csvEscape(row[c])).join(','))
    }
    const csv = lines.join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${schema.value.schema_name}__${name}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    st.error = err instanceof Error ? err.message : 'Export failed'
  } finally {
    st.exporting = false
  }
}

// ─── Schema delete ───────────────────────────────────────────────────────
const deleteOpen = ref(false)
const deleteBusy = ref(false)
const deleteError = ref('')

async function runDelete() {
  if (!schema.value) return
  deleteBusy.value = true
  deleteError.value = ''
  try {
    await deleteGraphSchema(schema.value.schema_name)
    deleteOpen.value = false
    router.push('/developer/graph')
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Delete failed'
  } finally {
    deleteBusy.value = false
  }
}

watch(schemaName, load, { immediate: false })
onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 text-xs text-[var(--app-muted)] hover:text-[var(--app-foreground)] self-start"
      @click="router.push('/developer/graph')"
    >
      <Icon icon="lucide:arrow-left" class="size-3.5" />
      Back to graph
    </button>

    <div v-if="loading && !schema" class="text-sm text-[var(--app-muted)]">Loading schema…</div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <template v-if="schema">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold font-mono truncate">{{ schema.schema_name }}</h1>
          <p class="text-sm text-[var(--app-muted)] mt-1">
            Provisioned schema — drops cascade to every table inside it.
          </p>
        </div>
        <button
          type="button"
          class="rounded-md border border-rose-500/40 px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-500/10 shrink-0"
          @click="deleteOpen = true"
        >
          <Icon icon="lucide:trash-2" class="size-3.5 inline mr-1" />
          Delete schema
        </button>
      </div>

      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]">
        <div class="flex items-center px-5 py-3 text-sm">
          <span class="text-xs uppercase tracking-wider text-[var(--app-muted)] w-32 shrink-0">Space</span>
          <code class="font-mono">{{ schema.space_id }}</code>
        </div>
        <div class="flex items-center px-5 py-3 text-sm">
          <span class="text-xs uppercase tracking-wider text-[var(--app-muted)] w-32 shrink-0">Project</span>
          <code class="font-mono">{{ schema.project_id || '—' }}</code>
        </div>
        <div class="flex items-center px-5 py-3 text-sm">
          <span class="text-xs uppercase tracking-wider text-[var(--app-muted)] w-32 shrink-0">Manifest version</span>
          <span class="tabular-nums">v{{ schema.manifest_version || '?' }}</span>
        </div>
        <div class="flex items-center px-5 py-3 text-sm">
          <span class="text-xs uppercase tracking-wider text-[var(--app-muted)] w-32 shrink-0">Provisioned</span>
          <span>{{ fmtDate(schema.provisioned_at) }}</span>
        </div>
      </div>

      <!-- Tables. Each model expands to (a) its field schema and (b) a live
           data drawer with paginated rows and CSV export. Data is loaded
           lazily on first expand. -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-medium">Tables</h2>
          <span class="text-xs text-[var(--app-muted)] tabular-nums">{{ models.length }}</span>
        </div>

        <div
          v-if="models.length"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
        >
          <div
            v-for="m in models"
            :key="m.name"
            class="px-5 py-3"
          >
            <button
              type="button"
              class="w-full flex items-center gap-3 text-left"
              @click="toggle(m.name)"
            >
              <Icon
                icon="lucide:chevron-right"
                class="size-3.5 text-[var(--app-muted)] transition-transform"
                :class="expanded.has(m.name) ? 'rotate-90' : ''"
              />
              <code class="text-sm font-medium font-mono">{{ m.name }}</code>
              <span class="text-xs text-[var(--app-muted)] tabular-nums">
                {{ m.fields.length }} {{ m.fields.length === 1 ? 'field' : 'fields' }}
              </span>
              <span
                v-if="tableData.get(m.name)?.total !== undefined && tableData.get(m.name)!.columns.length"
                class="text-xs text-[var(--app-muted)] tabular-nums"
              >
                · {{ tableData.get(m.name)!.total }} {{ tableData.get(m.name)!.total === 1 ? 'row' : 'rows' }}
              </span>
              <span
                v-if="m.options?.scope"
                class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-[var(--app-border)] text-[var(--app-muted)] ml-auto"
              >{{ m.options.scope }}</span>
            </button>

            <div v-if="expanded.has(m.name)" class="mt-3 ml-6 flex flex-col gap-3">
              <!-- Field schema -->
              <div class="rounded-md border border-[var(--app-border)] divide-y divide-[color:var(--app-border)]">
                <div
                  v-for="f in m.fields"
                  :key="f.name"
                  class="flex items-center gap-3 px-3 py-2 text-xs"
                >
                  <code class="font-mono w-40 shrink-0 truncate">{{ f.name }}</code>
                  <span class="text-[var(--app-muted)] flex-1 truncate">{{ fieldTypeLabel(f) }}</span>
                  <div class="flex items-center gap-1 shrink-0">
                    <span v-if="f.required" class="text-[10px] uppercase px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500">req</span>
                    <span v-if="f.unique" class="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">uniq</span>
                    <span v-if="f.index" class="text-[10px] uppercase px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600">idx</span>
                  </div>
                </div>
              </div>

              <!-- Data drawer -->
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs uppercase tracking-wider text-[var(--app-muted)]">Data</span>
                  <span v-if="tableData.get(m.name)?.busy" class="text-xs text-[var(--app-muted)]">loading…</span>
                  <span v-else class="text-xs text-[var(--app-muted)] tabular-nums">{{ pageLabel(tableData.get(m.name)) }}</span>
                  <div class="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      class="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs hover:bg-[var(--app-card-hover)] disabled:opacity-40"
                      :disabled="!tableData.get(m.name) || tableData.get(m.name)!.busy || tableData.get(m.name)!.offset === 0"
                      @click="prevPage(m.name)"
                    >
                      <Icon icon="lucide:chevron-left" class="size-3.5" />
                    </button>
                    <button
                      type="button"
                      class="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs hover:bg-[var(--app-card-hover)] disabled:opacity-40"
                      :disabled="!tableData.get(m.name) || tableData.get(m.name)!.busy || (tableData.get(m.name)!.offset + tableData.get(m.name)!.rows.length) >= tableData.get(m.name)!.total"
                      @click="nextPage(m.name)"
                    >
                      <Icon icon="lucide:chevron-right" class="size-3.5" />
                    </button>
                    <button
                      type="button"
                      class="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs hover:bg-[var(--app-card-hover)] disabled:opacity-40"
                      :disabled="!tableData.get(m.name) || tableData.get(m.name)!.busy || tableData.get(m.name)!.exporting || tableData.get(m.name)!.total === 0"
                      :title="tableData.get(m.name)?.total && tableData.get(m.name)!.total > 10000 ? `Capped at 10000 rows` : 'Export CSV'"
                      @click="exportTable(m.name)"
                    >
                      <Icon
                        :icon="tableData.get(m.name)?.exporting ? 'lucide:loader-2' : 'lucide:download'"
                        class="size-3.5"
                        :class="tableData.get(m.name)?.exporting ? 'animate-spin' : ''"
                      />
                    </button>
                  </div>
                </div>

                <p v-if="tableData.get(m.name)?.error" class="text-xs text-red-500">
                  {{ tableData.get(m.name)!.error }}
                </p>

                <div v-if="tableData.get(m.name) && tableData.get(m.name)!.columns.length" class="rounded-md border border-[var(--app-border)] overflow-x-auto">
                  <table class="w-full text-xs">
                    <thead class="bg-[var(--app-surface)]">
                      <tr>
                        <th
                          v-for="col in tableData.get(m.name)!.columns"
                          :key="col"
                          class="text-left font-mono font-medium px-3 py-1.5 text-[var(--app-muted)] whitespace-nowrap"
                        >{{ col }}</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-[color:var(--app-border)]">
                      <tr
                        v-for="(row, i) in tableData.get(m.name)!.rows"
                        :key="i"
                        class="hover:bg-[var(--app-card-hover)]"
                      >
                        <td
                          v-for="col in tableData.get(m.name)!.columns"
                          :key="col"
                          class="px-3 py-1.5 font-mono text-[var(--app-foreground)] max-w-xs truncate"
                          :title="cellText(row[col])"
                        >{{ cellText(row[col]) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div
                  v-else-if="tableData.get(m.name) && !tableData.get(m.name)!.busy"
                  class="rounded-md border border-dashed border-[var(--app-border)] px-3 py-6 text-center"
                >
                  <p class="text-xs text-[var(--app-muted)]">
                    {{ tableData.get(m.name)!.error ? 'Could not load rows.' : 'Empty table.' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-8 text-center">
          <p class="text-xs text-[var(--app-muted)]">
            No models defined for this space, or models couldn't be resolved.
          </p>
        </div>
      </div>
    </template>

    <ConfirmationModal
      v-model="deleteOpen"
      title="Delete schema"
      :message="`Drop schema ${schema?.schema_name}? Every table inside it is destroyed. The space (and any other schemas it has) survive.`"
      confirm-text="Delete"
      confirm-color="error"
      :loading="deleteBusy"
      @confirm="runDelete"
    />
    <p v-if="deleteError" class="text-xs text-red-500">{{ deleteError }}</p>
  </section>
</template>
