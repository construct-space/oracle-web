<script setup lang="ts">
import { Button, Input, SelectMenu } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { type Category, type MarketplaceSpace, listCategories, listSpaces, patchSpace } from './api'

const loading = ref(false)
const error = ref('')
const rows = ref<MarketplaceSpace[]>([])
const cats = ref<Category[]>([])
const search = ref('')
const filterCategory = ref<string | null>(null)

const editing = ref<Record<string, { category: string | null; tags: string }>>({})
const saving = ref<Record<string, boolean>>({})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [spaces, c] = await Promise.all([
      listSpaces({ q: search.value, category: filterCategory.value || '', pageSize: 100 }),
      listCategories(),
    ])
    rows.value = spaces.spaces
    cats.value = c.categories
    editing.value = {}
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

const categoryOptions = computed(() => [
  { label: 'All categories', value: null },
  ...cats.value.map((c) => ({ label: c.title, value: c.slug })),
])

const editCategoryOptions = computed(() => [
  { label: '— Uncategorized', value: null },
  ...cats.value.map((c) => ({ label: c.title, value: c.slug })),
])

function startEdit(row: MarketplaceSpace) {
  editing.value[row.id] = {
    category: row.category ?? null,
    tags: (row.tags || []).join(', '),
  }
}

function cancelEdit(name: string) {
  delete editing.value[name]
}

async function save(name: string) {
  const buf = editing.value[name]
  if (!buf) return
  saving.value[name] = true
  try {
    const tags = buf.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    await patchSpace(name, { category: buf.category, tags })
    delete editing.value[name]
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    delete saving.value[name]
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-7xl flex flex-col gap-5">
    <header class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Marketplace catalog</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">{{ rows.length }} live spaces · click a row to edit category and tags</p>
      </div>
      <Button variant="outline" color="neutral" size="sm" icon="lucide:refresh-cw" label="Refresh" @click="load" />
    </header>

    <div class="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Input v-model="search" icon="lucide:search" placeholder="Search by name…" size="sm" class="flex-1 min-w-48" @keyup.enter="load" />
      <SelectMenu v-model="filterCategory" :items="categoryOptions" size="sm" class="w-48" @update:model-value="load" />
      <Button color="primary" size="sm" label="Apply" @click="load" />
    </div>

    <p v-if="error" class="text-sm text-rose-500">{{ error }}</p>
    <p v-if="loading" class="text-sm text-[var(--app-muted)]">Loading…</p>

    <div v-if="!loading" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-[var(--app-surface)]">
          <tr>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5">Slug</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5">Title</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5">Publisher</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-48">Category</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5">Tags</th>
            <th class="text-right text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-36">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[color:var(--app-border)]">
          <tr v-for="row in rows" :key="row.id" class="hover:bg-[var(--app-card-hover)]">
            <td class="px-4 py-2 font-mono text-xs text-[var(--app-foreground)]">{{ row.id }}</td>
            <td class="px-4 py-2 text-[var(--app-foreground)]">{{ row.name }}</td>
            <td class="px-4 py-2 text-[var(--app-muted)] text-xs">{{ row.publisher_name || '—' }}</td>

            <td class="px-4 py-2">
              <SelectMenu v-if="editing[row.id]" v-model="editing[row.id].category" :items="editCategoryOptions" size="xs" />
              <span v-else-if="row.category" class="inline-flex text-xs px-2 py-0.5 rounded bg-sky-500/15 text-sky-400">{{ row.category }}</span>
              <span v-else class="text-xs text-[var(--app-muted)]">—</span>
            </td>

            <td class="px-4 py-2">
              <Input v-if="editing[row.id]" v-model="editing[row.id].tags" placeholder="comma, separated, tags" size="xs" />
              <template v-else-if="(row.tags || []).length">
                <span v-for="t in row.tags" :key="t" class="inline-flex mr-1 mb-0.5 text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">{{ t }}</span>
              </template>
              <span v-else class="text-xs text-[var(--app-muted)]">—</span>
            </td>

            <td class="px-4 py-2 text-right">
              <template v-if="editing[row.id]">
                <Button color="primary" size="xs" :loading="saving[row.id]" :label="saving[row.id] ? 'Saving…' : 'Save'" class="mr-1" @click="save(row.id)" />
                <Button variant="outline" color="neutral" size="xs" label="Cancel" @click="cancelEdit(row.id)" />
              </template>
              <Button v-else variant="link" color="primary" size="xs" icon="lucide:pencil" label="Edit" @click="startEdit(row)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
