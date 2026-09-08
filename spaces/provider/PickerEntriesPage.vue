<script setup lang="ts">
import { Button, Icon, Input } from '@construct-space/ui-web'
import { onMounted, ref } from 'vue'
import {
  type PickerEntry,
  type PickerEntryInput,
  type SourceFamilyOperator,
  createPickerEntry,
  deletePickerEntry,
  listPickerEntries,
  listSourceFamily,
  updatePickerEntry,
} from './api'

const loading = ref(false)
const error = ref('')
const rows = ref<PickerEntry[]>([])
const operators = ref<SourceFamilyOperator[]>([])
const editing = ref<Record<string, PickerEntryInput & { id: string }>>({})
const creating = ref<PickerEntryInput | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [entriesRes, opsRes] = await Promise.all([listPickerEntries(), listSourceFamily()])
    rows.value = entriesRes.entries
    operators.value = opsRes.operators
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
    label: '',
    description: '',
    icon: 'sparkles',
    route_via_operator: 'tank',
    route_via_operator_large: '',
    route_via_operator_small: '',
    capabilities: [],
    enabled: true,
    sort_order: 0,
  }
}

async function saveCreate() {
  if (!creating.value) return
  try {
    await createPickerEntry(creating.value)
    creating.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function startEdit(p: PickerEntry) {
  editing.value[p.id] = {
    id: p.id,
    label: p.label,
    description: p.description,
    icon: p.icon,
    route_via_operator: p.route_via_operator || 'tank',
    route_via_operator_large: p.route_via_operator_large || '',
    route_via_operator_small: p.route_via_operator_small || '',
    capabilities: p.capabilities ?? [],
    enabled: p.enabled,
    sort_order: p.sort_order,
  }
}

function cancelEdit(id: string) {
  delete editing.value[id]
}

async function saveEdit(id: string) {
  const body = editing.value[id]
  if (!body) return
  try {
    await updatePickerEntry(id, body)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function remove(id: string) {
  if (!confirm(`Delete picker entry "${id}"? Users will no longer see it in the picker.`)) return
  try {
    await deletePickerEntry(id)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function capsCsv(caps: string[] | null | undefined): string {
  return (caps ?? []).join(',')
}
function setCaps(target: PickerEntryInput, csv: string) {
  target.capabilities = csv.split(',').map((s) => s.trim()).filter(Boolean)
}

onMounted(load)
</script>

<template>
  <section class="space-y-4">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-[var(--app-foreground)]">Picker Entries</h1>
        <p class="text-sm text-[var(--app-muted)]">
          User-facing chat models shown in the desktop picker. Each entry is dispatched via
          <RouterLink to="/provider/source-family" class="underline">Source Family routing</RouterLink>
          — no upstream is pinned here.
        </p>
      </div>
      <Button v-if="!creating" color="primary" size="sm" label="Add entry" @click="startCreate" />
    </header>

    <div v-if="error" class="rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600">{{ error }}</div>

    <div class="overflow-x-auto rounded border border-[color:var(--app-border)]">
      <table class="min-w-full text-sm">
        <thead class="bg-[var(--app-card-hover)]">
          <tr>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-32">ID</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-44">Label</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5">Description</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-24">Icon</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-44">Routes via (L · M · S)</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5">Capabilities</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-16">Sort</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-16">On</th>
            <th class="text-right text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-3 py-2.5 w-32">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[color:var(--app-border)]">
          <tr v-if="creating" class="bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)]">
            <td class="px-3 py-2"><Input v-model="creating.id" placeholder="source" size="xs" class="font-mono" /></td>
            <td class="px-3 py-2"><Input v-model="creating.label" placeholder="Source" size="xs" /></td>
            <td class="px-3 py-2"><Input v-model="creating.description" size="xs" /></td>
            <td class="px-3 py-2"><Input v-model="creating.icon" placeholder="sparkles" size="xs" class="font-mono" /></td>
            <td class="px-3 py-2 space-y-1">
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-[var(--app-muted)] w-3">L</span>
                <select v-model="creating.route_via_operator_large" class="flex-1 rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-xs font-mono">
                  <option value="">— fall back to M —</option>
                  <option v-for="op in operators" :key="op.operator_id" :value="op.operator_id">{{ op.operator_id }}</option>
                </select>
              </div>
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-[var(--app-muted)] w-3">M</span>
                <select v-model="creating.route_via_operator" class="flex-1 rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-xs font-mono">
                  <option v-for="op in operators" :key="op.operator_id" :value="op.operator_id">{{ op.operator_id }}</option>
                </select>
              </div>
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-[var(--app-muted)] w-3">S</span>
                <select v-model="creating.route_via_operator_small" class="flex-1 rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-xs font-mono">
                  <option value="">— fall back to M —</option>
                  <option v-for="op in operators" :key="op.operator_id" :value="op.operator_id">{{ op.operator_id }}</option>
                </select>
              </div>
            </td>
            <td class="px-3 py-2">
              <Input :model-value="capsCsv(creating.capabilities)" placeholder="tools,vision,reasoning" size="xs"
                @update:model-value="setCaps(creating!, String($event))" />
            </td>
            <td class="px-3 py-2"><Input v-model.number="creating.sort_order" type="number" size="xs" /></td>
            <td class="px-3 py-2 text-center"><input v-model="creating.enabled" type="checkbox" /></td>
            <td class="px-3 py-2 text-right">
              <Button color="primary" size="xs" label="Create" class="mr-1" @click="saveCreate" />
              <Button variant="outline" color="neutral" size="xs" label="Cancel" @click="creating = null" />
            </td>
          </tr>

          <tr v-for="p in rows" :key="p.id" class="hover:bg-[var(--app-card-hover)]">
            <td class="px-3 py-2 font-mono text-xs">{{ p.id }}</td>
            <template v-if="editing[p.id]">
              <td class="px-3 py-2"><Input v-model="editing[p.id].label" size="xs" /></td>
              <td class="px-3 py-2"><Input v-model="editing[p.id].description" size="xs" /></td>
              <td class="px-3 py-2"><Input v-model="editing[p.id].icon" size="xs" class="font-mono" /></td>
              <td class="px-3 py-2 space-y-1">
                <div class="flex items-center gap-1">
                  <span class="text-[10px] text-[var(--app-muted)] w-3">L</span>
                  <select v-model="editing[p.id].route_via_operator_large" class="flex-1 rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-xs font-mono">
                    <option value="">— fall back to M —</option>
                    <option v-for="op in operators" :key="op.operator_id" :value="op.operator_id">{{ op.operator_id }}</option>
                  </select>
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-[10px] text-[var(--app-muted)] w-3">M</span>
                  <select v-model="editing[p.id].route_via_operator" class="flex-1 rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-xs font-mono">
                    <option v-for="op in operators" :key="op.operator_id" :value="op.operator_id">{{ op.operator_id }}</option>
                  </select>
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-[10px] text-[var(--app-muted)] w-3">S</span>
                  <select v-model="editing[p.id].route_via_operator_small" class="flex-1 rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-xs font-mono">
                    <option value="">— fall back to M —</option>
                    <option v-for="op in operators" :key="op.operator_id" :value="op.operator_id">{{ op.operator_id }}</option>
                  </select>
                </div>
              </td>
              <td class="px-3 py-2">
                <Input :model-value="capsCsv(editing[p.id].capabilities)" size="xs"
                  @update:model-value="setCaps(editing[p.id], String($event))" />
              </td>
              <td class="px-3 py-2"><Input v-model.number="editing[p.id].sort_order" type="number" size="xs" /></td>
              <td class="px-3 py-2 text-center"><input v-model="editing[p.id].enabled" type="checkbox" /></td>
              <td class="px-3 py-2 text-right">
                <Button color="primary" size="xs" label="Save" class="mr-1" @click="saveEdit(p.id)" />
                <Button variant="outline" color="neutral" size="xs" label="Cancel" @click="cancelEdit(p.id)" />
              </td>
            </template>
            <template v-else>
              <td class="px-3 py-2">{{ p.label }}</td>
              <td class="px-3 py-2 text-xs text-[var(--app-muted)]">{{ p.description }}</td>
              <td class="px-3 py-2 text-xs font-mono text-[var(--app-muted)]">{{ p.icon }}</td>
              <td class="px-3 py-2 text-xs font-mono leading-tight">
                <div class="text-[var(--app-muted)]">
                  <span class="opacity-60">L</span>&nbsp;{{ p.route_via_operator_large || (p.route_via_operator || 'tank') }}
                </div>
                <div class="text-[var(--app-fg)]">
                  <span class="opacity-60">M</span>&nbsp;{{ p.route_via_operator || 'tank' }}
                </div>
                <div class="text-[var(--app-muted)]">
                  <span class="opacity-60">S</span>&nbsp;{{ p.route_via_operator_small || (p.route_via_operator || 'tank') }}
                </div>
              </td>
              <td class="px-3 py-2 text-xs text-[var(--app-muted)]">{{ (p.capabilities ?? []).join(', ') }}</td>
              <td class="px-3 py-2 tabular-nums text-[var(--app-muted)]">{{ p.sort_order }}</td>
              <td class="px-3 py-2 text-center">
                <Icon v-if="p.enabled" icon="lucide:check" class="inline size-4 text-emerald-500" />
                <Icon v-else icon="lucide:x" class="inline size-4 text-[var(--app-muted)]" />
              </td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <Button variant="link" color="primary" size="xs" label="Edit" class="mr-2" @click="startEdit(p)" />
                <Button variant="link" color="error" size="xs" label="Delete" @click="remove(p.id)" />
              </td>
            </template>
          </tr>

          <tr v-if="!loading && rows.length === 0 && !creating">
            <td colspan="9" class="px-4 py-8 text-center text-sm text-[var(--app-muted)]">No picker entries yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
