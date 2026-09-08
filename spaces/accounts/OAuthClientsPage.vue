<script setup lang="ts">
import { Modal } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { type AccountOAuthClient, createOAuthClient, listOAuthClients, type OAuthClientInput } from './api'

const router = useRouter()
const loading = ref(false)
const error = ref('')
const clients = ref<AccountOAuthClient[]>([])
const search = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    clients.value = (await listOAuthClients()).data
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load OAuth clients'
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return clients.value
  return clients.value.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.client_id.toLowerCase().includes(q) ||
      c.redirect_uri.toLowerCase().includes(q),
  )
})

// ─── Create modal state ──────────────────────────────────────────────────
const createOpen = ref(false)
const createBusy = ref(false)
const createError = ref('')
const form = ref<OAuthClientInput>({ name: '', redirect_uri: '', description: '' })
const createdSecret = ref<{ client_id: string; secret: string } | null>(null)

function openCreate() {
  form.value = { name: '', redirect_uri: '', description: '' }
  createError.value = ''
  createdSecret.value = null
  createOpen.value = true
}

async function submitCreate() {
  createError.value = ''
  if (!form.value.name.trim() || !form.value.redirect_uri.trim()) {
    createError.value = 'Name and redirect URI are required.'
    return
  }
  createBusy.value = true
  try {
    const res = await createOAuthClient({
      name: form.value.name.trim(),
      redirect_uri: form.value.redirect_uri.trim(),
      description: form.value.description?.trim() || null,
    })
    createdSecret.value = { client_id: res.data.client_id, secret: res.client_secret }
    await load()
  } catch (err) {
    createError.value = err instanceof Error ? err.message : 'Failed to create client'
  } finally {
    createBusy.value = false
  }
}

function finishCreate() {
  createOpen.value = false
  if (createdSecret.value) {
    const id = clients.value.find((c) => c.client_id === createdSecret.value!.client_id)?.id
    if (id) router.push(`/accounts/oauth-clients/${id}`)
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* ignored */
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">OAuth clients</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">Registered clients that can request authorization against Construct accounts.</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 transition-opacity shrink-0"
        @click="openCreate"
      >
        <Icon icon="lucide:plus" class="size-4" />
        <span>New client</span>
      </button>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search by name, client ID, or redirect URI…"
        class="w-full bg-transparent text-sm text-[var(--app-foreground)] outline-none placeholder:text-[var(--app-muted)]"
        aria-label="Filter OAuth clients"
      />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !clients.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="filtered.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <RouterLink
        v-for="client in filtered"
        :key="client.id"
        :to="`/accounts/oauth-clients/${client.id}`"
        class="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--app-card-hover)]"
      >
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:shield" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ client.name }}</div>
          <div class="text-xs text-[var(--app-muted)] truncate font-mono">{{ client.client_id }}</div>
        </div>
        <div class="text-xs text-[var(--app-muted)] truncate max-w-xs hidden md:block">
          {{ client.redirect_uri }}
        </div>
        <span
          class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0"
          :class="client.active ? 'bg-emerald-500/15 text-emerald-600' : 'bg-[var(--app-surface)] text-[var(--app-muted)]'"
        >
          {{ client.active ? 'Active' : 'Inactive' }}
        </span>
      </RouterLink>
    </div>

    <div v-else-if="!loading && !clients.length" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:shield" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No OAuth clients registered</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Click "New client" to register one.
      </p>
    </div>

    <div v-else class="text-sm text-[var(--app-muted)] text-center py-8">
      No clients match your search.
    </div>

    <!-- Create / secret-reveal modal -->
    <Modal v-model:open="createOpen">
      <template #header>
        <h3 class="text-lg font-semibold">
          {{ createdSecret ? 'Client created — save the secret' : 'New OAuth client' }}
        </h3>
      </template>

      <template #body>
        <form v-if="!createdSecret" class="flex flex-col gap-3" @submit.prevent="submitCreate">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Name *</span>
            <input
              v-model="form.name"
              type="text"
              required
              placeholder="e.g. Construct App"
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Redirect URI *</span>
            <input
              v-model="form.redirect_uri"
              type="url"
              required
              placeholder="https://app.example.com/oauth/callback"
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] font-mono"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Description</span>
            <textarea
              v-model="form.description"
              rows="2"
              placeholder="Optional context for staff."
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] resize-none"
            />
          </label>
          <p v-if="createError" class="text-xs text-red-500">{{ createError }}</p>
        </form>

        <div v-else class="flex flex-col gap-3">
          <p class="text-sm text-[var(--app-muted)]">
            Copy the secret now — Construct does not store it in plaintext and can't show it again.
            You'll need it to bootstrap the client application.
          </p>
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <div class="text-xs text-[var(--app-muted)] w-24 shrink-0">Client ID</div>
              <code class="flex-1 rounded bg-[var(--app-surface)] px-2 py-1 text-xs font-mono truncate">{{ createdSecret.client_id }}</code>
              <button class="size-7 grid place-items-center rounded text-[var(--app-muted)] hover:bg-[var(--app-card-hover)]" title="Copy" @click="copyToClipboard(createdSecret.client_id)">
                <Icon icon="lucide:copy" class="size-3.5" />
              </button>
            </div>
            <div class="flex items-center gap-2">
              <div class="text-xs text-[var(--app-muted)] w-24 shrink-0">Client secret</div>
              <code class="flex-1 rounded bg-[var(--app-surface)] px-2 py-1 text-xs font-mono truncate">{{ createdSecret.secret }}</code>
              <button class="size-7 grid place-items-center rounded text-[var(--app-muted)] hover:bg-[var(--app-card-hover)]" title="Copy" @click="copyToClipboard(createdSecret.secret)">
                <Icon icon="lucide:copy" class="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div v-if="!createdSecret" class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]"
            :disabled="createBusy"
            @click="createOpen = false"
          >Cancel</button>
          <button
            type="button"
            class="rounded-md bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            :disabled="createBusy"
            @click="submitCreate"
          >{{ createBusy ? 'Creating…' : 'Create' }}</button>
        </div>
        <button
          v-else
          type="button"
          class="rounded-md bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          @click="finishCreate"
        >I've saved it — open detail</button>
      </template>
    </Modal>
  </section>
</template>
