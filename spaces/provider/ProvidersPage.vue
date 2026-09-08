<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { createProvider, listProviders, type ProviderListItem } from './api'

const providers = ref<ProviderListItem[]>([])
const version = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

const creating = ref(false)
const createError = ref<string | null>(null)
const draft = ref({ id: '', slug: '', name: '', default_mode: 'api_key' as 'api_key' | 'monthly' })

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await listProviders()
    providers.value = res.providers
    version.value = res.version
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function submitCreate() {
  if (!draft.value.id || !draft.value.slug || !draft.value.name) return
  creating.value = true
  createError.value = null
  try {
    // Create with one mode enabled as a starting point — admin fills in
    // the details (base_url, env_keys, etc.) on the detail page.
    await createProvider({
      id: draft.value.id.trim(),
      slug: draft.value.slug.trim(),
      name: draft.value.name.trim(),
      api_key: draft.value.default_mode === 'api_key' ? { enabled: true } : undefined,
      monthly: draft.value.default_mode === 'monthly' ? { enabled: true, auth_type: 'oauth_pkce' } : undefined,
    })
    draft.value = { id: '', slug: '', name: '', default_mode: 'api_key' }
    await load()
  } catch (e) {
    createError.value = e instanceof Error ? e.message : String(e)
  } finally {
    creating.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Providers</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        AI provider catalog served to every Construct client. Add a new model here to push it to
        users without an app release.
      </p>
      <p v-if="version" class="mt-1 text-xs text-[var(--app-muted)] font-mono">catalog v{{ version }}</p>
    </div>

    <!-- Create row -->
    <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-3">
      <div class="text-sm font-medium">Add provider</div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          v-model="draft.id"
          type="text"
          placeholder="id (lowercase)"
          class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm"
        />
        <input
          v-model="draft.slug"
          type="text"
          placeholder="slug"
          class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm"
        />
        <input
          v-model="draft.name"
          type="text"
          placeholder="Display name"
          class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm"
        />
        <select
          v-model="draft.default_mode"
          class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm"
          title="Start with this mode enabled — configure details on the detail page"
        >
          <option value="api_key">API key mode</option>
          <option value="monthly">Monthly plan mode</option>
        </select>
      </div>
      <div class="flex items-center gap-3">
        <button
          :disabled="!draft.id || !draft.slug || !draft.name || creating"
          class="inline-flex items-center gap-2 rounded-lg bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          @click="submitCreate"
        >
          <Icon v-if="creating" icon="lucide:loader-2" class="size-3.5 animate-spin" />
          <Icon v-else icon="lucide:plus" class="size-3.5" />
          Create
        </button>
        <p v-if="createError" class="text-xs text-red-500">{{ createError }}</p>
      </div>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !providers.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="providers.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <RouterLink
        v-for="p in providers"
        :key="p.id"
        :to="`/provider/providers/${p.id}`"
        class="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--app-card-hover)]"
      >
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon :icon="`lucide:${p.icon || 'cpu'}`" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-medium truncate">{{ p.name }}</span>
            <span
              v-if="!p.enabled"
              class="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0"
            >
              disabled
            </span>
            <span
              v-if="p.api_key?.enabled"
              class="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--app-accent)]/15 text-[var(--app-accent)] shrink-0"
              title="API key mode is enabled"
            >
              API key
            </span>
            <span
              v-if="p.monthly?.enabled"
              class="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-500 shrink-0"
              title="Monthly plan mode is enabled"
            >
              Monthly
            </span>
            <span
              v-if="p.api_key?.has_shared_key"
              class="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0"
              title="Org-shared key is allowed"
            >
              <Icon icon="lucide:users" class="size-3" />
              shared
            </span>
          </div>
          <div class="text-xs text-[var(--app-muted)] font-mono truncate">{{ p.id }}</div>
        </div>
        <div class="hidden md:flex items-center gap-4 text-xs text-[var(--app-muted)] shrink-0">
          <span><strong class="text-[var(--app-foreground)]">{{ p.model_count }}</strong> models</span>
          <span v-if="p.min_app_version" class="font-mono">min v{{ p.min_app_version }}</span>
        </div>
      </RouterLink>
    </div>

    <div
      v-else-if="!loading"
      class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center"
    >
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:cpu" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No providers yet — add the first one above.</div>
    </div>
  </section>
</template>
