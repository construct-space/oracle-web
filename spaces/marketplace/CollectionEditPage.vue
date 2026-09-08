<script setup lang="ts">
import { Button, Card, Input, SelectMenu } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  type Collection,
  type MarketplaceSpace,
  addSpaceToCollection,
  getCollection,
  listSpaces,
  removeSpaceFromCollection,
  reorderCollection,
  updateCollection,
} from './api'

const route = useRoute()
const router = useRouter()

const collectionId = computed(() => String(route.params.id || ''))

const loading = ref(false)
const saving = ref(false)
const error = ref('')

const col = ref<Collection | null>(null)
const spaces = ref<MarketplaceSpace[]>([])
const allSpaces = ref<MarketplaceSpace[]>([])
const selectedToAdd = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [detail, all] = await Promise.all([
      getCollection(collectionId.value),
      listSpaces({ pageSize: 200 }),
    ])
    col.value = detail.collection
    spaces.value = detail.spaces
    allSpaces.value = all.spaces
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

const candidateOptions = computed(() => {
  const inCol = new Set(spaces.value.map((s) => s.id))
  return [
    { label: 'Pick a space to add…', value: null },
    ...allSpaces.value.filter((s) => !inCol.has(s.id)).map((s) => ({ label: `${s.name}  ·  ${s.id}`, value: s.id })),
  ]
})

async function add() {
  if (!selectedToAdd.value) return
  try {
    await addSpaceToCollection(collectionId.value, selectedToAdd.value)
    selectedToAdd.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function remove(spaceName: string) {
  try {
    await removeSpaceFromCollection(collectionId.value, spaceName)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function moveUp(idx: number) {
  if (idx <= 0) return
  const arr = [...spaces.value]
  ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
  spaces.value = arr
}

function moveDown(idx: number) {
  if (idx >= spaces.value.length - 1) return
  const arr = [...spaces.value]
  ;[arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]]
  spaces.value = arr
}

async function saveOrder() {
  saving.value = true
  try {
    await reorderCollection(collectionId.value, spaces.value.map((s) => s.id))
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

async function saveCollection() {
  if (!col.value) return
  saving.value = true
  try {
    await updateCollection(collectionId.value, col.value)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

onMounted(load)

const labelCls = 'text-xs uppercase tracking-wider text-[var(--app-muted)]'
</script>

<template>
  <section class="max-w-7xl flex flex-col gap-5">
    <header class="flex items-center gap-3">
      <Button variant="outline" color="neutral" size="xs" icon="lucide:arrow-left" label="Collections" @click="router.push('/marketplace/collections')" />
      <h1 v-if="col" class="text-xl font-semibold">{{ col.title }}</h1>
      <span v-if="col"
        class="text-xs px-2 py-0.5 rounded"
        :class="col.kind === 'manual' ? 'bg-violet-500/15 text-violet-300' : 'bg-amber-500/15 text-amber-400'"
      >{{ col.kind }}</span>
    </header>

    <p v-if="error" class="text-sm text-rose-500">{{ error }}</p>
    <p v-if="loading" class="text-sm text-[var(--app-muted)]">Loading…</p>

    <Card v-if="col" title="Metadata">
      <div class="grid grid-cols-2 gap-4">
        <label class="block space-y-1.5"><span :class="labelCls">Title</span><Input v-model="col.title" size="sm" /></label>
        <label class="block space-y-1.5"><span :class="labelCls">Slug</span><Input :model-value="col.slug" disabled size="sm" class="font-mono" /></label>
        <label class="block col-span-2 space-y-1.5"><span :class="labelCls">Subtitle</span><Input v-model="col.subtitle" size="sm" /></label>
        <label class="block col-span-2 space-y-1.5"><span :class="labelCls">Hero image URL</span><Input v-model="col.hero_image_url" size="sm" /></label>
        <label class="block space-y-1.5"><span :class="labelCls">Priority</span><Input v-model.number="col.priority" type="number" size="sm" /></label>
      </div>
      <div class="mt-4">
        <Button color="primary" size="sm" :loading="saving" label="Save metadata" @click="saveCollection" />
      </div>
    </Card>

    <Card v-if="col?.kind === 'manual'">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-[var(--app-muted)]">Spaces ({{ spaces.length }})</h2>
          <Button color="primary" size="sm" :loading="saving" :label="saving ? 'Saving…' : 'Save order'" @click="saveOrder" />
        </div>
      </template>

      <div class="flex gap-2 items-center mb-3">
        <SelectMenu v-model="selectedToAdd" :items="candidateOptions" size="sm" class="flex-1" />
        <Button color="success" size="sm" :disabled="!selectedToAdd" icon="lucide:plus" label="Add" @click="add" />
      </div>

      <ol v-if="spaces.length" class="space-y-1">
        <li
          v-for="(s, idx) in spaces"
          :key="s.id"
          class="flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-card-hover)]"
        >
          <span class="text-xs text-[var(--app-muted)] font-mono w-6 text-right tabular-nums">{{ idx + 1 }}.</span>
          <span class="flex-1 text-sm text-[var(--app-foreground)]">{{ s.name }}</span>
          <span class="text-xs text-[var(--app-muted)] font-mono">{{ s.id }}</span>
          <Button variant="ghost" color="neutral" size="xs" icon="lucide:chevron-up" :disabled="idx === 0" @click="moveUp(idx)" />
          <Button variant="ghost" color="neutral" size="xs" icon="lucide:chevron-down" :disabled="idx === spaces.length - 1" @click="moveDown(idx)" />
          <Button variant="ghost" color="error" size="xs" icon="lucide:x" @click="remove(s.id)" />
        </li>
      </ol>
      <div v-else class="rounded-md border border-dashed border-[var(--app-border)] p-6 text-center">
        <p class="text-sm text-[var(--app-muted)]">No spaces yet. Pick one above and Add.</p>
      </div>
    </Card>

    <Card v-else-if="col?.kind === 'dynamic'" title="Dynamic preview">
      <p class="text-xs text-[var(--app-muted)] mb-3">Query-driven collections compute their members at read time. Editing the query is not yet exposed in this UI.</p>
      <pre class="text-xs text-[var(--app-foreground)] bg-[var(--app-surface)] border border-[var(--app-border)] p-3 rounded-md overflow-x-auto">{{ col.query }}</pre>
      <ol class="space-y-1 mt-3">
        <li v-for="s in spaces" :key="s.id" class="text-sm px-3 py-1 text-[var(--app-foreground)]">
          {{ s.name }} <span class="text-xs text-[var(--app-muted)] font-mono">({{ s.id }})</span>
        </li>
      </ol>
    </Card>
  </section>
</template>
