<script setup lang="ts">
import { Button, Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import {
  type RoutingTarget,
  type SourceFamilyOperator,
  listRoutingTargets,
  listSourceFamily,
  upsertSourceFamilyOperator,
} from './api'

// One editable view per operator. Built from the API response by
// flattening the route refs into plain model_id arrays — saving sends
// the full set back so the server can replace rows atomically.
interface EditState {
  primary: string
  backups: string[]
  aggregator: string
  proposers: string[]
  dirty: boolean
  saving: boolean
}

const loading = ref(false)
const error = ref('')
const operators = ref<SourceFamilyOperator[]>([])
const models = ref<RoutingTarget[]>([])
const edits = ref<Record<string, EditState>>({})

// Static per-operator copy. Description is no longer part of the
// route schema so we keep it in the UI; it never went into the DB.
const OPERATOR_INFO: Record<string, { label: string; description: string }> = {
  tank:     { label: 'Tank',     description: 'Router. Picks which Source operator handles each turn.' },
  trinity:  { label: 'Trinity',  description: 'Fast tier — text + tool dispatch + narrow factual.' },
  apoc:     { label: 'Apoc',     description: 'Code generation, scaffolding spaces, long-context refactors.' },
  mouse:    { label: 'Mouse',    description: 'Design IR + vision-grounded layout generation.' },
  oracle:   { label: 'Oracle',   description: 'Staff-only visual triage and document reading.' },
  neo:      { label: 'Neo',      description: 'Mid-tier reasoning when MoA is overkill.' },
  morpheus: { label: 'Morpheus', description: 'Pro mode — Mixture-of-Agents ensemble.' },
}

// Dropdown options. Label shape is `<upstream_provider>/<upstream_model>`
// — every routing target now has these fields populated (the schema
// split removed the routed-vs-passthrough ambiguity).
const modelOptions = computed(() =>
  models.value.map((t) => ({
    id: t.id,
    label: `${t.upstream_provider_id}/${t.upstream_model}`,
    sublabel: t.label,
  })),
)

function modelLabel(id: string): string {
  if (!id) return ''
  const t = models.value.find((x) => x.id === id)
  if (!t) return id
  return `${t.upstream_provider_id}/${t.upstream_model}`
}

function modelSublabel(id: string): string {
  const t = models.value.find((x) => x.id === id)
  return t?.label || ''
}

function operatorKind(op: SourceFamilyOperator): 'single' | 'moa' {
  if (op.aggregator || op.proposers.length > 0) return 'moa'
  return 'single'
}

function resetEdit(op: SourceFamilyOperator) {
  edits.value[op.operator_id] = {
    primary: op.primary?.model_id ?? '',
    backups: op.backups.map((b) => b.model_id),
    aggregator: op.aggregator?.model_id ?? '',
    proposers: op.proposers.map((p) => p.model_id),
    dirty: false,
    saving: false,
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [opsRes, targetsRes] = await Promise.all([listSourceFamily(), listRoutingTargets()])
    operators.value = opsRes.operators
    models.value = targetsRes.targets
    edits.value = {}
    for (const op of operators.value) resetEdit(op)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function markDirty(opId: string) {
  const e = edits.value[opId]
  if (e) e.dirty = true
}

function addBackup(opId: string) {
  const e = edits.value[opId]
  if (!e) return
  e.backups.push('')
  e.dirty = true
}

function removeBackup(opId: string, i: number) {
  const e = edits.value[opId]
  if (!e) return
  e.backups.splice(i, 1)
  e.dirty = true
}

function moveBackup(opId: string, i: number, dir: -1 | 1) {
  const e = edits.value[opId]
  if (!e) return
  const j = i + dir
  if (j < 0 || j >= e.backups.length) return
  ;[e.backups[i], e.backups[j]] = [e.backups[j], e.backups[i]]
  e.dirty = true
}

function addProposer(opId: string) {
  const e = edits.value[opId]
  if (!e) return
  e.proposers.push('')
  e.dirty = true
}

function removeProposer(opId: string, i: number) {
  const e = edits.value[opId]
  if (!e) return
  e.proposers.splice(i, 1)
  e.dirty = true
}

function moveProposer(opId: string, i: number, dir: -1 | 1) {
  const e = edits.value[opId]
  if (!e) return
  const j = i + dir
  if (j < 0 || j >= e.proposers.length) return
  ;[e.proposers[i], e.proposers[j]] = [e.proposers[j], e.proposers[i]]
  e.dirty = true
}

async function save(opId: string) {
  const e = edits.value[opId]
  if (!e) return
  e.saving = true
  try {
    const updated = await upsertSourceFamilyOperator(opId, {
      primary: e.primary || undefined,
      backups: e.backups.filter((m) => m),
      aggregator: e.aggregator || undefined,
      proposers: e.proposers.filter((m) => m),
    })
    // Replace the in-memory operator and refresh the edit state from
    // the server's response so positions / route ids stay in sync.
    const idx = operators.value.findIndex((o) => o.operator_id === opId)
    if (idx >= 0) operators.value[idx] = updated
    resetEdit(updated)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    e.saving = false
  }
}

function cancel(opId: string) {
  const op = operators.value.find((o) => o.operator_id === opId)
  if (op) resetEdit(op)
}

onMounted(load)
</script>

<template>
  <section class="space-y-4">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-lg font-semibold text-[var(--app-fg)]">Source family routing</h1>
        <p class="mt-1 text-sm text-[var(--app-muted)]">
          Per-operator primary, ordered backups, and Mixture-of-Agents recipe.
          Models are labelled <code class="font-mono">provider/model</code> — pick from
          the Construct catalog. Save replaces the operator's routes atomically.
        </p>
      </div>
      <Button variant="outline" color="neutral" size="sm" label="Refresh" @click="load" />
    </header>

    <div v-if="error" class="rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600">{{ error }}</div>

    <div v-if="loading" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div v-else-if="operators.length === 0" class="rounded border border-[color:var(--app-border)] px-4 py-8 text-center text-sm text-[var(--app-muted)]">
      No operators configured. Run <code class="font-mono text-xs">seeds/source-family.sql</code> against provider-api to populate.
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="op in operators"
        :key="op.operator_id"
        class="rounded border border-[color:var(--app-border)] bg-[var(--app-card)]"
      >
        <header class="flex items-start justify-between gap-4 border-b border-[color:var(--app-border)] px-4 py-3">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="font-mono text-sm font-semibold text-[var(--app-fg)]">
                {{ OPERATOR_INFO[op.operator_id]?.label ?? op.operator_id }}
              </h2>
              <span class="rounded bg-[var(--app-card-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase text-[var(--app-muted)]">
                {{ operatorKind(op) }}
              </span>
            </div>
            <p class="mt-1 text-xs text-[var(--app-muted)]">
              {{ OPERATOR_INFO[op.operator_id]?.description ?? '' }}
            </p>
          </div>
          <div v-if="edits[op.operator_id]?.dirty" class="flex items-center gap-2">
            <Button
              variant="outline"
              color="neutral"
              size="xs"
              label="Cancel"
              :disabled="edits[op.operator_id].saving"
              @click="cancel(op.operator_id)"
            />
            <Button
              color="primary"
              size="xs"
              :label="edits[op.operator_id].saving ? 'Saving…' : 'Save'"
              :disabled="edits[op.operator_id].saving"
              @click="save(op.operator_id)"
            />
          </div>
        </header>

        <div v-if="edits[op.operator_id]" class="grid gap-4 px-4 py-3 md:grid-cols-2">
          <!-- ── Single-tier: primary + backups ───────────────────── -->
          <div v-if="operatorKind(op) === 'single'" class="md:col-span-2 grid gap-4 md:grid-cols-2">
            <div>
              <label class="block text-xs font-medium text-[var(--app-muted)] mb-1">Primary</label>
              <select
                v-model="edits[op.operator_id].primary"
                class="w-full rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1.5 text-xs font-mono"
                @change="markDirty(op.operator_id)"
              >
                <option value="">— pick model —</option>
                <option v-for="m in modelOptions" :key="m.id" :value="m.id">{{ m.label }} — {{ m.sublabel }}</option>
              </select>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs font-medium text-[var(--app-muted)]">Backups (in order)</label>
                <Button variant="link" color="primary" size="xs" label="+ Add backup" @click="addBackup(op.operator_id)" />
              </div>
              <div v-if="edits[op.operator_id].backups.length === 0" class="text-xs text-[var(--app-muted)] italic">No backups — operator fails hard.</div>
              <div v-else class="space-y-1">
                <div
                  v-for="(_, i) in edits[op.operator_id].backups"
                  :key="i"
                  class="flex items-center gap-1"
                >
                  <span class="text-[10px] text-[var(--app-muted)] font-mono w-4 text-right">{{ i + 1 }}.</span>
                  <select
                    v-model="edits[op.operator_id].backups[i]"
                    class="flex-1 rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-xs font-mono"
                    @change="markDirty(op.operator_id)"
                  >
                    <option value="">— pick model —</option>
                    <option v-for="m in modelOptions" :key="m.id" :value="m.id">{{ m.label }} — {{ m.sublabel }}</option>
                  </select>
                  <button
                    type="button"
                    class="text-[var(--app-muted)] hover:text-[var(--app-fg)] disabled:opacity-30"
                    :disabled="i === 0"
                    @click="moveBackup(op.operator_id, i, -1)"
                    title="Move up"
                  >
                    <Icon icon="lucide:chevron-up" class="size-3.5" />
                  </button>
                  <button
                    type="button"
                    class="text-[var(--app-muted)] hover:text-[var(--app-fg)] disabled:opacity-30"
                    :disabled="i === edits[op.operator_id].backups.length - 1"
                    @click="moveBackup(op.operator_id, i, 1)"
                    title="Move down"
                  >
                    <Icon icon="lucide:chevron-down" class="size-3.5" />
                  </button>
                  <button
                    type="button"
                    class="text-red-500/70 hover:text-red-500"
                    @click="removeBackup(op.operator_id, i)"
                    title="Remove"
                  >
                    <Icon icon="lucide:x" class="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ── MoA: aggregator + proposers ──────────────────────── -->
          <div v-else class="md:col-span-2 grid gap-4 md:grid-cols-2">
            <div>
              <label class="block text-xs font-medium text-[var(--app-muted)] mb-1">Aggregator</label>
              <select
                v-model="edits[op.operator_id].aggregator"
                class="w-full rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1.5 text-xs font-mono"
                @change="markDirty(op.operator_id)"
              >
                <option value="">— pick model —</option>
                <option v-for="m in modelOptions" :key="m.id" :value="m.id">{{ m.label }} — {{ m.sublabel }}</option>
              </select>
              <p class="mt-1 text-[10px] text-[var(--app-muted)]">Synthesises proposer outputs into the final reply.</p>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs font-medium text-[var(--app-muted)]">Proposers</label>
                <Button variant="link" color="primary" size="xs" label="+ Add proposer" @click="addProposer(op.operator_id)" />
              </div>
              <div v-if="edits[op.operator_id].proposers.length === 0" class="text-xs text-[var(--app-muted)] italic">No proposers configured.</div>
              <div v-else class="space-y-1">
                <div
                  v-for="(_, i) in edits[op.operator_id].proposers"
                  :key="i"
                  class="flex items-center gap-1"
                >
                  <span class="text-[10px] text-[var(--app-muted)] font-mono w-4 text-right">{{ i + 1 }}.</span>
                  <select
                    v-model="edits[op.operator_id].proposers[i]"
                    class="flex-1 rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-xs font-mono"
                    @change="markDirty(op.operator_id)"
                  >
                    <option value="">— pick model —</option>
                    <option v-for="m in modelOptions" :key="m.id" :value="m.id">{{ m.label }} — {{ m.sublabel }}</option>
                  </select>
                  <button
                    type="button"
                    class="text-[var(--app-muted)] hover:text-[var(--app-fg)] disabled:opacity-30"
                    :disabled="i === 0"
                    @click="moveProposer(op.operator_id, i, -1)"
                    title="Move up"
                  >
                    <Icon icon="lucide:chevron-up" class="size-3.5" />
                  </button>
                  <button
                    type="button"
                    class="text-[var(--app-muted)] hover:text-[var(--app-fg)] disabled:opacity-30"
                    :disabled="i === edits[op.operator_id].proposers.length - 1"
                    @click="moveProposer(op.operator_id, i, 1)"
                    title="Move down"
                  >
                    <Icon icon="lucide:chevron-down" class="size-3.5" />
                  </button>
                  <button
                    type="button"
                    class="text-red-500/70 hover:text-red-500"
                    @click="removeProposer(op.operator_id, i)"
                    title="Remove"
                  >
                    <Icon icon="lucide:x" class="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>

    <p class="text-xs text-[var(--app-muted)]">
      <Icon icon="lucide:info" class="inline size-3.5 align-text-bottom" />
      Models above come from
      <RouterLink to="/provider/construct/routing-targets" class="underline">Routing Targets</RouterLink>.
      Labels show <code class="font-mono">upstream_provider/upstream_model</code>; add a model there if you need a new routing target.
    </p>
  </section>
</template>
