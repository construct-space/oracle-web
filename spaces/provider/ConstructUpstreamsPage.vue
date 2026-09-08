<script setup lang="ts">
import { Button, Icon, Input } from '@construct-space/ui-web'
import { onMounted, ref } from 'vue'
import {
  type ConstructUpstream,
  type ConstructUpstreamInput,
  createConstructUpstream,
  deleteConstructUpstream,
  listConstructUpstreams,
  updateConstructUpstream,
} from './api'

const loading = ref(false)
const error = ref('')
const rows = ref<ConstructUpstream[]>([])
const editing = ref<Record<string, ConstructUpstreamInput & { id: string }>>({})
const creating = ref<ConstructUpstreamInput | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const r = await listConstructUpstreams()
    rows.value = r.upstreams
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
    base_url: '',
    auth_header: 'authorization-bearer',
    api_key: '',
    enabled: true,
  }
}

async function saveCreate() {
  if (!creating.value) return
  try {
    await createConstructUpstream(creating.value)
    creating.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function startEdit(u: ConstructUpstream) {
  editing.value[u.id] = {
    id: u.id,
    label: u.label,
    base_url: u.base_url,
    auth_header: u.auth_header,
    api_key: '', // empty = don't rotate
    enabled: u.enabled,
  }
}

function cancelEdit(id: string) {
  delete editing.value[id]
}

async function saveEdit(id: string) {
  const body = editing.value[id]
  if (!body) return
  try {
    await updateConstructUpstream(id, body)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function remove(id: string) {
  if (!confirm(`Delete upstream "${id}"? Models still using it must be reassigned first.`)) return
  try {
    await deleteConstructUpstream(id)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(load)
</script>

<template>
  <section class="space-y-4">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-[var(--app-foreground)]">Construct — Upstream Keys</h1>
        <p class="text-sm text-[var(--app-muted)]">
          Real API keys for the upstreams that Construct models route to. One row per upstream; many models can share one.
        </p>
      </div>
      <Button v-if="!creating" color="primary" size="sm" label="Add upstream" @click="startCreate" />
    </header>

    <div v-if="error" class="rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600">{{ error }}</div>

    <div class="overflow-x-auto rounded border border-[color:var(--app-border)]">
      <table class="min-w-full text-sm">
        <thead class="bg-[var(--app-card-hover)]">
          <tr>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-40">ID</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-40">Label</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5">Base URL</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-44">Auth Header</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-44">API Key</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-20">Enabled</th>
            <th class="text-right text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-40">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[color:var(--app-border)]">
          <tr v-if="creating" class="bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)]">
            <td class="px-4 py-2"><Input v-model="creating.id" placeholder="openai-prod" size="xs" class="font-mono" /></td>
            <td class="px-4 py-2"><Input v-model="creating.label" placeholder="OpenAI" size="xs" /></td>
            <td class="px-4 py-2"><Input v-model="creating.base_url" placeholder="https://api.openai.com/v1" size="xs" /></td>
            <td class="px-4 py-2">
              <select v-model="creating.auth_header" class="w-full rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-xs">
                <option value="authorization-bearer">authorization-bearer</option>
                <option value="x-api-key">x-api-key</option>
              </select>
            </td>
            <td class="px-4 py-2"><Input v-model="creating.api_key" type="password" placeholder="sk-..." size="xs" /></td>
            <td class="px-4 py-2 text-center"><input v-model="creating.enabled" type="checkbox" /></td>
            <td class="px-4 py-2 text-right">
              <Button color="primary" size="xs" label="Create" class="mr-1" @click="saveCreate" />
              <Button variant="outline" color="neutral" size="xs" label="Cancel" @click="creating = null" />
            </td>
          </tr>

          <tr v-for="u in rows" :key="u.id" class="hover:bg-[var(--app-card-hover)]">
            <td class="px-4 py-2 font-mono text-xs">{{ u.id }}</td>
            <template v-if="editing[u.id]">
              <td class="px-4 py-2"><Input v-model="editing[u.id].label" size="xs" /></td>
              <td class="px-4 py-2"><Input v-model="editing[u.id].base_url" size="xs" /></td>
              <td class="px-4 py-2">
                <select v-model="editing[u.id].auth_header" class="w-full rounded border border-[color:var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-xs">
                  <option value="authorization-bearer">authorization-bearer</option>
                  <option value="x-api-key">x-api-key</option>
                </select>
              </td>
              <td class="px-4 py-2"><Input v-model="editing[u.id].api_key" type="password" placeholder="leave blank to keep current" size="xs" /></td>
              <td class="px-4 py-2 text-center"><input v-model="editing[u.id].enabled" type="checkbox" /></td>
              <td class="px-4 py-2 text-right">
                <Button color="primary" size="xs" label="Save" class="mr-1" @click="saveEdit(u.id)" />
                <Button variant="outline" color="neutral" size="xs" label="Cancel" @click="cancelEdit(u.id)" />
              </td>
            </template>
            <template v-else>
              <td class="px-4 py-2">{{ u.label }}</td>
              <td class="px-4 py-2 font-mono text-xs text-[var(--app-muted)]">{{ u.base_url }}</td>
              <td class="px-4 py-2 font-mono text-xs text-[var(--app-muted)]">{{ u.auth_header }}</td>
              <td class="px-4 py-2">
                <span v-if="u.api_key === 'configured'" class="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <Icon icon="lucide:check" class="size-3.5" /> configured
                </span>
                <span v-else class="text-xs text-[var(--app-muted)]">not set</span>
              </td>
              <td class="px-4 py-2 text-center">
                <Icon v-if="u.enabled" icon="lucide:check" class="inline size-4 text-emerald-500" />
                <Icon v-else icon="lucide:x" class="inline size-4 text-[var(--app-muted)]" />
              </td>
              <td class="px-4 py-2 text-right">
                <Button variant="link" color="primary" size="xs" label="Edit" class="mr-2" @click="startEdit(u)" />
                <Button variant="link" color="error" size="xs" label="Delete" @click="remove(u.id)" />
              </td>
            </template>
          </tr>

          <tr v-if="!loading && rows.length === 0 && !creating">
            <td colspan="7" class="px-4 py-8 text-center text-sm text-[var(--app-muted)]">
              No upstreams yet. Add one before creating Construct models.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
