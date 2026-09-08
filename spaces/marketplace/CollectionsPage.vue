<script setup lang="ts">
import { Button, Card, Input, SelectMenu } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { type Collection, createCollection, deleteCollection, listCollections } from './api'

const loading = ref(false)
const error = ref('')
const cols = ref<Collection[]>([])
const creating = ref<Partial<Collection> | null>(null)

const kindOptions = [
  { label: 'Manual (staff picks the order)', value: 'manual' },
  { label: 'Dynamic (query-driven, e.g. trending)', value: 'dynamic' },
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const r = await listCollections()
    cols.value = r.collections || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function startCreate() {
  creating.value = { slug: '', title: '', subtitle: '', kind: 'manual', priority: 100 }
}

async function saveCreate() {
  if (!creating.value) return
  try {
    await createCollection(creating.value)
    creating.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function remove(c: Collection) {
  if (!confirm(`Delete collection "${c.title}"? This removes the collection and all space memberships.`)) return
  try {
    await deleteCollection(c.id)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-7xl flex flex-col gap-5">
    <header class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Collections</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">{{ cols.length }} collections · App-Store-style curated lists</p>
      </div>
      <Button color="primary" size="sm" icon="lucide:plus" label="New collection" @click="startCreate" />
    </header>

    <p v-if="error" class="text-sm text-rose-500">{{ error }}</p>

    <Card v-if="creating" title="New collection">
      <div class="grid grid-cols-2 gap-4">
        <label class="block space-y-1.5">
          <span class="text-xs uppercase tracking-wider text-[var(--app-muted)]">Slug (e.g. staff-picks)</span>
          <Input v-model="creating.slug" placeholder="staff-picks" size="sm" class="font-mono" />
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs uppercase tracking-wider text-[var(--app-muted)]">Title</span>
          <Input v-model="creating.title" placeholder="Staff Picks" size="sm" />
        </label>
        <label class="block col-span-2 space-y-1.5">
          <span class="text-xs uppercase tracking-wider text-[var(--app-muted)]">Subtitle</span>
          <Input v-model="creating.subtitle" size="sm" />
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs uppercase tracking-wider text-[var(--app-muted)]">Kind</span>
          <SelectMenu v-model="creating.kind" :items="kindOptions" size="sm" />
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs uppercase tracking-wider text-[var(--app-muted)]">Priority (lower shows first)</span>
          <Input v-model.number="creating.priority" type="number" size="sm" />
        </label>
      </div>
      <div class="flex gap-2 mt-4">
        <Button color="primary" size="sm" label="Create" @click="saveCreate" />
        <Button variant="outline" color="neutral" size="sm" label="Cancel" @click="creating = null" />
      </div>
    </Card>

    <div v-if="!loading && cols.length" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-[var(--app-surface)]">
          <tr>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5">Title</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5">Slug</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-28">Kind</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5">Subtitle</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-16">Pri</th>
            <th class="text-right text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-32">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[color:var(--app-border)]">
          <tr v-for="c in cols" :key="c.id" class="hover:bg-[var(--app-card-hover)]">
            <td class="px-4 py-2 text-[var(--app-foreground)]">
              <RouterLink :to="`/marketplace/collections/${c.id}`" class="font-medium hover:underline">{{ c.title }}</RouterLink>
            </td>
            <td class="px-4 py-2 font-mono text-xs text-[var(--app-muted)]">{{ c.slug }}</td>
            <td class="px-4 py-2">
              <span class="inline-flex text-xs px-2 py-0.5 rounded" :class="c.kind === 'manual' ? 'bg-violet-500/15 text-violet-300' : 'bg-amber-500/15 text-amber-400'">{{ c.kind }}</span>
            </td>
            <td class="px-4 py-2 text-[var(--app-muted)] text-xs">{{ c.subtitle || '—' }}</td>
            <td class="px-4 py-2 tabular-nums text-[var(--app-muted)]">{{ c.priority }}</td>
            <td class="px-4 py-2 text-right">
              <RouterLink :to="`/marketplace/collections/${c.id}`" class="text-xs text-[var(--app-accent)] hover:underline mr-3">Manage</RouterLink>
              <Button variant="link" color="error" size="xs" label="Delete" @click="remove(c)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!loading && !creating" class="rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-card-bg)] p-8 text-center">
      <Icon icon="lucide:star" class="mx-auto size-8 text-[var(--app-muted)]" />
      <p class="mt-2 text-sm text-[var(--app-muted)]">No collections yet. Click "New collection" to add Staff Picks, Trending, etc.</p>
    </div>
  </section>
</template>
