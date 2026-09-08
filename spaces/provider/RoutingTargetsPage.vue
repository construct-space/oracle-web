<script setup lang="ts">
import { Button, Icon, Input } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import {
  type ConstructUpstream,
  type RoutingTarget,
  type RoutingTargetInput,
  type SourceFamilyOperator,
  createRoutingTarget,
  deleteRoutingTarget,
  listConstructUpstreams,
  listRoutingTargets,
  listSourceFamily,
  updateRoutingTarget,
} from './api'

const loading = ref(false)
const error = ref('')
const rows = ref<RoutingTarget[]>([])
const upstreams = ref<ConstructUpstream[]>([])
const operators = ref<SourceFamilyOperator[]>([])
const editing = ref<Record<string, RoutingTargetInput & { id: string }>>({})
const creating = ref<RoutingTargetInput | null>(null)

// usedBy maps target.id → list of human-readable slot refs (e.g.
// "apoc/backup #1", "morpheus/aggregator"). Computed from
// source_family_routes so admins can see whether a target is reachable
// via routing before deleting.
const usedBy = computed<Record<string, string[]>>(() => {
  const m: Record<string, string[]> = {}
  for (const op of operators.value) {
    if (op.primary?.model_id) {
      ;(m[op.primary.model_id] ||= []).push(`${op.operator_id}/primary`)
    }
    op.backups.forEach((b, i) => {
      ;(m[b.model_id] ||= []).push(`${op.operator_id}/backup #${i + 1}`)
    })
    if (op.aggregator?.model_id) {
      ;(m[op.aggregator.model_id] ||= []).push(`${op.operator_id}/aggregator`)
    }
    op.proposers.forEach((p, i) => {
      ;(m[p.model_id] ||= []).push(`${op.operator_id}/proposer #${i + 1}`)
    })
  }
  return m
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [t, u, s] = await Promise.all([
      listRoutingTargets(),
      listConstructUpstreams(),
      listSourceFamily(),
    ])
    rows.value = t.targets
    upstreams.value = u.upstreams
    operators.value = s.operators
    editing.value = {}
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function startCreate() {
  creating.value = {
    id: '',
    upstream_provider_id: upstreams.value[0]?.id || '',
    upstream_model: '',
    label: '',
    description: '',
    icon: '',
    credits_per_prompt: 1,
    max_tool_calls_per_credit: 20,
    max_output_tokens_per_credit: 4096,
    thinking_mode: '',
    capabilities: [],
    enabled: true,
    sort_order: 0,
  }
}

async function saveCreate() {
  if (!creating.value) return
  try {
    await createRoutingTarget(creating.value)
    creating.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function startEdit(t: RoutingTarget) {
  editing.value[t.id] = {
    id: t.id,
    upstream_provider_id: t.upstream_provider_id,
    upstream_model: t.upstream_model,
    label: t.label,
    description: t.description,
    icon: t.icon,
    credits_per_prompt: t.credits_per_prompt,
    max_tool_calls_per_credit: t.max_tool_calls_per_credit,
    max_output_tokens_per_credit: t.max_output_tokens_per_credit,
    thinking_mode: t.thinking_mode ?? '',
    capabilities: t.capabilities ?? [],
    enabled: t.enabled,
    sort_order: t.sort_order,
  }
}

function cancelEdit(id: string) {
  delete editing.value[id]
}

async function saveEdit(id: string) {
  const body = editing.value[id]
  if (!body) return
  try {
    await updateRoutingTarget(id, body)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function remove(id: string) {
  const refs = usedBy.value[id]
  if (refs && refs.length > 0) {
    alert(`Cannot delete: referenced by source-family routes — ${refs.join(', ')}.`)
    return
  }
  if (!confirm(`Delete routing target "${id}"?`)) return
  try {
    await deleteRoutingTarget(id)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function capsCsv(caps: string[] | null | undefined): string {
  return (caps ?? []).join(',')
}
function setCaps(target: RoutingTargetInput, csv: string) {
  target.capabilities = csv.split(',').map((s) => s.trim()).filter(Boolean)
}

onMounted(load)
</script>

<template>
  <section class="space-y-4">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-[var(--app-foreground)]">Routing Targets</h1>
        <p class="text-sm text-[var(--app-muted)]">
          Internal aliases bound to one upstream + model id. Referenced by
          <RouterLink to="/provider/source-family" class="underline">Source Family routing</RouterLink>
          — never user-visible.
        </p>
      </div>
      <Button v-if="!creating" color="primary" size="sm" label="Add target" :disabled="upstreams.length === 0" @click="startCreate" />
    </header>

    <div v-if="error" class="rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600">{{ error }}</div>
    <div v-if="upstreams.length === 0" class="rounded border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700">
      Add an upstream first under <RouterLink to="/provider/construct/upstreams" class="underline">Upstream Keys</RouterLink>.
    </div>

    <div class="overflow-x-auto rounded border border-[color:var(--app-border)]">
      <table class="min-w-full text-sm">
        <thead class="bg-[var(--app-card-hover)]">
          <tr>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-44">ID</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5">Label</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-56">Upstream</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-56">Used by</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-16">Cr/Q</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-16">Tools</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-20">Out tok</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-24">Think</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-16">Sort</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-16">On</th>
            <th class="text-right text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-32">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[color:var(--app-border)]">
          <tr v-if="creating" class="bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)]">
            <td class="px-3 py-2"><Input v-model="creating.id" placeholder="construct-apoc" size="xs" class="font-mono" /></td>
            <td class="px-3 py-2"><Input v-model="creating.label" placeholder="Apoc (code)" size="xs" /></td>
            <td class="px-3 py-2">
              <select v-model="creating.upstream_provider_id" class="w-full rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-xs">
                <option v-for="u in upstreams" :key="u.id" :value="u.id">{{ u.label }}</option>
              </select>
              <Input v-model="creating.upstream_model" placeholder="deepseek/deepseek-v4-pro" size="xs" class="font-mono mt-1" />
            </td>
            <td class="px-3 py-2 text-[10px] text-[var(--app-muted)]">—</td>
            <td class="px-3 py-2"><Input v-model.number="creating.credits_per_prompt" type="number" size="xs" /></td>
            <td class="px-3 py-2"><Input v-model.number="creating.max_tool_calls_per_credit" type="number" size="xs" /></td>
            <td class="px-3 py-2"><Input v-model.number="creating.max_output_tokens_per_credit" type="number" size="xs" /></td>
            <td class="px-3 py-2">
              <select v-model="creating.thinking_mode" class="w-full rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-xs">
                <option value="">auto</option>
                <option value="off">off</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </td>
            <td class="px-3 py-2"><Input v-model.number="creating.sort_order" type="number" size="xs" /></td>
            <td class="px-3 py-2 text-center"><input v-model="creating.enabled" type="checkbox" /></td>
            <td class="px-3 py-2 text-right">
              <Button color="primary" size="xs" label="Create" class="mr-1" @click="saveCreate" />
              <Button variant="outline" color="neutral" size="xs" label="Cancel" @click="creating = null" />
            </td>
          </tr>

          <tr v-for="t in rows" :key="t.id" class="hover:bg-[var(--app-card-hover)]">
            <td class="px-3 py-2 font-mono text-xs">{{ t.id }}</td>
            <template v-if="editing[t.id]">
              <td class="px-3 py-2"><Input v-model="editing[t.id].label" size="xs" /></td>
              <td class="px-3 py-2">
                <select v-model="editing[t.id].upstream_provider_id" class="w-full rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-xs">
                  <option v-for="u in upstreams" :key="u.id" :value="u.id">{{ u.label }}</option>
                </select>
                <Input v-model="editing[t.id].upstream_model" size="xs" class="font-mono mt-1" />
              </td>
              <td class="px-3 py-2 text-[10px] text-[var(--app-muted)]">
                <template v-if="usedBy[t.id]?.length">
                  <div v-for="ref in usedBy[t.id]" :key="ref" class="font-mono leading-tight">{{ ref }}</div>
                </template>
                <span v-else>—</span>
              </td>
              <td class="px-3 py-2"><Input v-model.number="editing[t.id].credits_per_prompt" type="number" size="xs" /></td>
              <td class="px-3 py-2"><Input v-model.number="editing[t.id].max_tool_calls_per_credit" type="number" size="xs" /></td>
              <td class="px-3 py-2"><Input v-model.number="editing[t.id].max_output_tokens_per_credit" type="number" size="xs" /></td>
              <td class="px-3 py-2">
                <select v-model="editing[t.id].thinking_mode" class="w-full rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-xs">
                  <option value="">auto</option>
                  <option value="off">off</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </td>
              <td class="px-3 py-2"><Input v-model.number="editing[t.id].sort_order" type="number" size="xs" /></td>
              <td class="px-3 py-2 text-center"><input v-model="editing[t.id].enabled" type="checkbox" /></td>
              <td class="px-3 py-2 text-right">
                <Button color="primary" size="xs" label="Save" class="mr-1" @click="saveEdit(t.id)" />
                <Button variant="outline" color="neutral" size="xs" label="Cancel" @click="cancelEdit(t.id)" />
              </td>
            </template>
            <template v-else>
              <td class="px-3 py-2">{{ t.label }}</td>
              <td class="px-3 py-2 font-mono text-xs text-[var(--app-muted)]">{{ t.upstream_provider_id }}/{{ t.upstream_model }}</td>
              <td class="px-3 py-2 text-[10px]">
                <template v-if="usedBy[t.id]?.length">
                  <div v-for="ref in usedBy[t.id]" :key="ref" class="font-mono leading-tight text-[var(--app-fg)]">{{ ref }}</div>
                </template>
                <span v-else class="text-[var(--app-muted)] italic">unused</span>
              </td>
              <td class="px-3 py-2 tabular-nums">{{ t.credits_per_prompt }}</td>
              <td class="px-3 py-2 tabular-nums text-[var(--app-muted)]">{{ t.max_tool_calls_per_credit }}</td>
              <td class="px-3 py-2 tabular-nums text-[var(--app-muted)]">{{ t.max_output_tokens_per_credit }}</td>
              <td class="px-3 py-2 text-xs text-[var(--app-muted)]">{{ t.thinking_mode || 'auto' }}</td>
              <td class="px-3 py-2 tabular-nums text-[var(--app-muted)]">{{ t.sort_order }}</td>
              <td class="px-3 py-2 text-center">
                <Icon v-if="t.enabled" icon="lucide:check" class="inline size-4 text-emerald-500" />
                <Icon v-else icon="lucide:x" class="inline size-4 text-[var(--app-muted)]" />
              </td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <Button variant="link" color="primary" size="xs" label="Edit" class="mr-2" @click="startEdit(t)" />
                <Button
                  variant="link"
                  :color="usedBy[t.id]?.length ? 'neutral' : 'error'"
                  size="xs"
                  label="Delete"
                  :title="usedBy[t.id]?.length ? `Referenced by ${usedBy[t.id].join(', ')}` : 'Delete this routing target'"
                  :disabled="!!usedBy[t.id]?.length"
                  @click="remove(t.id)"
                />
              </td>
            </template>
          </tr>

          <tr v-if="!loading && rows.length === 0 && !creating">
            <td colspan="11" class="px-4 py-8 text-center text-sm text-[var(--app-muted)]">No routing targets yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
