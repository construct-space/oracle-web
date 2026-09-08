<script setup lang="ts">
import { Button, Card, Icon, Input } from '@construct-space/ui-web'
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { type BlogPost, createPost, deletePost, listPosts } from './api'

const router = useRouter()

const loading = ref(false)
const error = ref('')
const posts = ref<BlogPost[]>([])
const creating = ref<{ title: string; slug: string } | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const r = await listPosts()
    posts.value = r.posts || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function startCreate() {
  creating.value = { title: '', slug: '' }
}

async function saveCreate() {
  if (!creating.value || !creating.value.title.trim()) return
  try {
    const post = await createPost(creating.value)
    creating.value = null
    // Jump straight into the editor to write the body.
    router.push(`/blog/posts/${post.id}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function remove(p: BlogPost) {
  if (!confirm(`Delete post "${p.title}"? This cannot be undone.`)) return
  try {
    await deletePost(p.id)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(load)
</script>

<template>
  <section class="max-w-7xl flex flex-col gap-5">
    <header class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Blog</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">{{ posts.length }} posts · published to lisaos.dev/blog</p>
      </div>
      <Button color="primary" size="sm" icon="lucide:plus" label="New post" @click="startCreate" />
    </header>

    <p v-if="error" class="text-sm text-rose-500">{{ error }}</p>

    <Card v-if="creating" title="New post">
      <div class="grid grid-cols-2 gap-4">
        <label class="block space-y-1.5">
          <span class="text-xs uppercase tracking-wider text-[var(--app-muted)]">Title</span>
          <Input v-model="creating.title" placeholder="A clear, specific headline" size="sm" />
        </label>
        <label class="block space-y-1.5">
          <span class="text-xs uppercase tracking-wider text-[var(--app-muted)]">Slug (optional — derived from title)</span>
          <Input v-model="creating.slug" placeholder="auto-generated" size="sm" class="font-mono" />
        </label>
      </div>
      <div class="flex gap-2 mt-4">
        <Button color="primary" size="sm" label="Create draft &amp; edit" @click="saveCreate" />
        <Button variant="outline" color="neutral" size="sm" label="Cancel" @click="creating = null" />
      </div>
    </Card>

    <div v-if="!loading && posts.length" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-[var(--app-surface)]">
          <tr>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5">Title</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5">Slug</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-28">Status</th>
            <th class="text-left text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-36">Published</th>
            <th class="text-right text-xs uppercase tracking-wider font-medium text-[var(--app-muted)] px-4 py-2.5 w-28">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[color:var(--app-border)]">
          <tr v-for="p in posts" :key="p.id" class="hover:bg-[var(--app-card-hover)]">
            <td class="px-4 py-2 text-[var(--app-foreground)]">
              <RouterLink :to="`/blog/posts/${p.id}`" class="font-medium hover:underline">{{ p.title }}</RouterLink>
            </td>
            <td class="px-4 py-2 font-mono text-xs text-[var(--app-muted)]">{{ p.slug }}</td>
            <td class="px-4 py-2">
              <span
                class="inline-flex text-xs px-2 py-0.5 rounded"
                :class="p.status === 'published' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-500/15 text-zinc-400'"
              >{{ p.status }}</span>
            </td>
            <td class="px-4 py-2 text-[var(--app-muted)] text-xs">{{ fmtDate(p.published_at) }}</td>
            <td class="px-4 py-2 text-right">
              <RouterLink :to="`/blog/posts/${p.id}`" class="text-xs text-[var(--app-accent)] hover:underline mr-3">Edit</RouterLink>
              <Button variant="link" color="error" size="xs" label="Delete" @click="remove(p)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!loading && !creating" class="rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-card-bg)] p-8 text-center">
      <Icon icon="lucide:newspaper" class="mx-auto size-8 text-[var(--app-muted)]" />
      <p class="mt-2 text-sm text-[var(--app-muted)]">No posts yet. Click "New post" to write your first article.</p>
    </div>
  </section>
</template>
