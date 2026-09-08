<script setup lang="ts">
import { Button, Input } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { onMounted, ref } from 'vue'
import { type Category, createCategory, deleteCategory, listCategories, updateCategory } from './api'

const loading = ref(false)
const error = ref('')
const cats = ref<Category[]>([])
const editing = ref<Record<string, Category>>({})
const creating = ref<Category | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const r = await listCategories()
    cats.value = r.categories
    editing.value = {}
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function startCreate() {
  creating.value = { slug: '', title: '', description: '', icon: '', position: 999, visible: true }
}

async function saveCreate() {
  if (!creating.value) return
  try {
    await createCategory(creating.value)
    creating.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function startEdit(c: Category) {
  editing.value[c.slug] = { ...c }
}

function cancelEdit(slug: string) {
  delete editing.value[slug]
}

async function saveEdit(slug: string) {
  const buf = editing.value[slug]
  if (!buf) return
  try {
    await updateCategory(slug, buf)
    delete editing.value[slug]
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function remove(slug: string) {
  if (!confirm(`Delete category "${slug}"? Spaces in this category will become uncategorized.`)) return
  try {
    await deleteCategory(slug)
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
        <h1 class="text-xl font-semibold">Categories</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">{{ cats.length }} categories · top-level catalog taxonomy</p>
      </div>
      <Button color="primary" size="sm" icon="lucide:plus" label="New category" @click="startCreate" />
    </header>

    <p v-if="error" class="text-sm text-rose-500">{{ error }}</p>

    <div v-if="!loading" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-[var(--app-surface)]">
          <tr>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-32">Slug</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5">Title</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5">Description</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-36">Icon</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-16">Pos</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-20">Visible</th>
            <th class="text-right text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-32">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[color:var(--app-border)]">
          <tr v-if="creating" class="bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)]">
            <td class="px-4 py-2"><Input v-model="creating.slug" placeholder="slug" size="xs" class="font-mono" /></td>
            <td class="px-4 py-2"><Input v-model="creating.title" placeholder="Title" size="xs" /></td>
            <td class="px-4 py-2"><Input v-model="creating.description" placeholder="Description" size="xs" /></td>
            <td class="px-4 py-2"><Input v-model="creating.icon" placeholder="lucide-name" size="xs" /></td>
            <td class="px-4 py-2"><Input v-model.number="creating.position" type="number" size="xs" /></td>
            <td class="px-4 py-2 text-center"><input v-model="creating.visible" type="checkbox" /></td>
            <td class="px-4 py-2 text-right">
              <Button color="primary" size="xs" label="Create" class="mr-1" @click="saveCreate" />
              <Button variant="outline" color="neutral" size="xs" label="Cancel" @click="creating = null" />
            </td>
          </tr>

          <tr v-for="c in cats" :key="c.slug" class="hover:bg-[var(--app-card-hover)]">
            <td class="px-4 py-2 font-mono text-xs text-[var(--app-foreground)]">{{ c.slug }}</td>

            <template v-if="editing[c.slug]">
              <td class="px-4 py-2"><Input v-model="editing[c.slug].title" size="xs" /></td>
              <td class="px-4 py-2"><Input v-model="editing[c.slug].description" size="xs" /></td>
              <td class="px-4 py-2"><Input v-model="editing[c.slug].icon" size="xs" /></td>
              <td class="px-4 py-2"><Input v-model.number="editing[c.slug].position" type="number" size="xs" /></td>
              <td class="px-4 py-2 text-center"><input v-model="editing[c.slug].visible" type="checkbox" /></td>
              <td class="px-4 py-2 text-right">
                <Button color="primary" size="xs" label="Save" class="mr-1" @click="saveEdit(c.slug)" />
                <Button variant="outline" color="neutral" size="xs" label="Cancel" @click="cancelEdit(c.slug)" />
              </td>
            </template>
            <template v-else>
              <td class="px-4 py-2 text-[var(--app-foreground)]">{{ c.title }}</td>
              <td class="px-4 py-2 text-[var(--app-muted)] text-xs">{{ c.description }}</td>
              <td class="px-4 py-2 font-mono text-xs text-[var(--app-muted)]">{{ c.icon }}</td>
              <td class="px-4 py-2 tabular-nums text-[var(--app-muted)]">{{ c.position }}</td>
              <td class="px-4 py-2 text-center">
                <Icon v-if="c.visible" icon="lucide:check" class="inline size-4 text-emerald-500" />
                <Icon v-else icon="lucide:x" class="inline size-4 text-[var(--app-muted)]" />
              </td>
              <td class="px-4 py-2 text-right">
                <Button variant="link" color="primary" size="xs" label="Edit" class="mr-2" @click="startEdit(c)" />
                <Button variant="link" color="error" size="xs" label="Delete" @click="remove(c.slug)" />
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
