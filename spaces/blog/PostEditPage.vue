<script setup lang="ts">
import { Button, Card, Icon, Input, Textarea } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { type BlogPost, deletePost, getPost, publishPost, unpublishPost, updatePost } from './api'

const route = useRoute()
const router = useRouter()

const postId = computed(() => String(route.params.id || ''))

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const post = ref<BlogPost | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    post.value = await getPost(postId.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

// persist() throws on failure — callers own the saving flag and error
// handling. Keeps togglePublish from publishing stale content when the
// save it depends on actually failed.
async function persist() {
  if (!post.value) return
  post.value = await updatePost(postId.value, {
    title: post.value.title,
    slug: post.value.slug,
    excerpt: post.value.excerpt,
    content: post.value.content,
    cover_image: post.value.cover_image,
    tags: post.value.tags,
    author: post.value.author,
  })
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    await persist()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

async function togglePublish() {
  if (!post.value) return
  saving.value = true
  error.value = ''
  try {
    // Persist edits first so the public site sees the latest content the
    // moment it goes live. If the save fails, abort — don't publish stale.
    await persist()
    post.value =
      post.value.status === 'published'
        ? await unpublishPost(postId.value)
        : await publishPost(postId.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!post.value) return
  if (!confirm(`Delete post "${post.value.title}"? This cannot be undone.`)) return
  try {
    await deletePost(postId.value)
    router.push('/blog/posts')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

const labelCls = 'text-xs uppercase tracking-wider text-[var(--app-muted)]'
const isPublished = computed(() => post.value?.status === 'published')

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <header class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <Button variant="ghost" color="neutral" size="sm" icon="lucide:arrow-left" label="Posts" @click="router.push('/blog/posts')" />
        <h1 class="text-xl font-semibold">{{ post?.title || 'Post' }}</h1>
        <span
          v-if="post"
          class="inline-flex text-xs px-2 py-0.5 rounded"
          :class="isPublished ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-500/15 text-zinc-400'"
        >{{ post.status }}</span>
      </div>
      <div class="flex gap-2" v-if="post">
        <Button color="primary" size="sm" icon="lucide:save" :label="saving ? 'Saving…' : 'Save'" :disabled="saving" @click="save" />
        <Button
          :color="isPublished ? 'neutral' : 'success'"
          :variant="isPublished ? 'outline' : 'solid'"
          size="sm"
          :icon="isPublished ? 'lucide:eye-off' : 'lucide:globe'"
          :label="isPublished ? 'Unpublish' : 'Publish'"
          :disabled="saving"
          @click="togglePublish"
        />
      </div>
    </header>

    <p v-if="error" class="text-sm text-rose-500">{{ error }}</p>

    <div v-if="post" class="flex flex-col gap-5">
      <Card title="Details">
        <div class="grid grid-cols-2 gap-4">
          <label class="block col-span-2 space-y-1.5">
            <span :class="labelCls">Title</span>
            <Input v-model="post.title" size="sm" />
          </label>
          <label class="block space-y-1.5">
            <span :class="labelCls">Slug</span>
            <Input v-model="post.slug" size="sm" class="font-mono" />
          </label>
          <label class="block space-y-1.5">
            <span :class="labelCls">Author</span>
            <Input v-model="post.author" placeholder="Construct" size="sm" />
          </label>
          <label class="block space-y-1.5">
            <span :class="labelCls">Cover image URL</span>
            <Input v-model="post.cover_image" placeholder="https://…" size="sm" />
          </label>
          <label class="block space-y-1.5">
            <span :class="labelCls">Tags (comma-separated)</span>
            <Input v-model="post.tags" placeholder="product, engineering" size="sm" />
          </label>
          <label class="block col-span-2 space-y-1.5">
            <span :class="labelCls">Excerpt (optional — shown in listings)</span>
            <Textarea v-model="post.excerpt" :rows="2" placeholder="One or two sentences summarising the post." />
          </label>
        </div>
      </Card>

      <Card title="Content">
        <p class="text-xs text-[var(--app-muted)] mb-2 flex items-center gap-1.5">
          <Icon icon="lucide:file-text" class="size-3.5" /> Markdown — headings, lists, links, code, and images.
        </p>
        <Textarea v-model="post.content" :rows="20" class="font-mono text-sm" placeholder="# Write your post in Markdown…" />
      </Card>

      <div class="flex justify-between items-center pt-2">
        <Button variant="link" color="error" size="sm" icon="lucide:trash-2" label="Delete post" @click="remove" />
        <Button color="primary" size="sm" icon="lucide:save" :label="saving ? 'Saving…' : 'Save changes'" :disabled="saving" @click="save" />
      </div>
    </div>

    <div v-else-if="loading" class="text-sm text-[var(--app-muted)]">Loading…</div>
  </section>
</template>
