<script setup lang="ts">
import { ConfirmationModal, Modal } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  deleteOAuthClient,
  getOAuthClient,
  type OAuthClientDetail,
  type OAuthClientInput,
  regenerateOAuthClientSecret,
  revokeClientAuthorization,
  updateOAuthClient,
} from './api'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const error = ref('')
const detail = ref<OAuthClientDetail | null>(null)

const clientId = computed(() => String(route.params.id || ''))
const client = computed(() => detail.value?.data ?? null)

async function load() {
  if (!clientId.value) return
  loading.value = true
  error.value = ''
  try {
    detail.value = await getOAuthClient(clientId.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load client'
  } finally {
    loading.value = false
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* ignored */
  }
}

// ─── Edit modal ──────────────────────────────────────────────────────────
const editOpen = ref(false)
const editBusy = ref(false)
const editError = ref('')
const editForm = ref<OAuthClientInput>({ name: '', redirect_uri: '', description: '' })

function openEdit() {
  if (!client.value) return
  editForm.value = {
    name: client.value.name,
    redirect_uri: client.value.redirect_uri,
    description: client.value.description ?? '',
  }
  editError.value = ''
  editOpen.value = true
}

async function submitEdit() {
  editError.value = ''
  if (!editForm.value.name.trim() || !editForm.value.redirect_uri.trim()) {
    editError.value = 'Name and redirect URI are required.'
    return
  }
  editBusy.value = true
  try {
    await updateOAuthClient(clientId.value, {
      name: editForm.value.name.trim(),
      redirect_uri: editForm.value.redirect_uri.trim(),
      description: editForm.value.description?.trim() || null,
    })
    editOpen.value = false
    await load()
  } catch (err) {
    editError.value = err instanceof Error ? err.message : 'Failed to update'
  } finally {
    editBusy.value = false
  }
}

// ─── Toggle active ───────────────────────────────────────────────────────
const toggleBusy = ref(false)
async function toggleActive() {
  if (!client.value) return
  toggleBusy.value = true
  try {
    await updateOAuthClient(clientId.value, { active: !client.value.active })
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to toggle'
  } finally {
    toggleBusy.value = false
  }
}

// ─── Delete confirmation ─────────────────────────────────────────────────
const deleteOpen = ref(false)
const deleteBusy = ref(false)
async function confirmDelete() {
  deleteBusy.value = true
  try {
    await deleteOAuthClient(clientId.value)
    router.push('/accounts/oauth-clients')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete'
  } finally {
    deleteBusy.value = false
    deleteOpen.value = false
  }
}

// ─── Regenerate secret ───────────────────────────────────────────────────
const regenConfirmOpen = ref(false)
const regenRevealOpen = ref(false)
const regenBusy = ref(false)
const newSecret = ref<string | null>(null)
async function confirmRegen() {
  regenBusy.value = true
  try {
    const res = await regenerateOAuthClientSecret(clientId.value)
    newSecret.value = res.client_secret
    regenConfirmOpen.value = false
    regenRevealOpen.value = true
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to regenerate'
    regenConfirmOpen.value = false
  } finally {
    regenBusy.value = false
  }
}

// ─── Revoke authorization ────────────────────────────────────────────────
const revokeOpen = ref(false)
const revokeBusy = ref(false)
const revokeTarget = ref<number | null>(null)
function promptRevoke(userID: number) {
  revokeTarget.value = userID
  revokeOpen.value = true
}
async function confirmRevoke() {
  if (!client.value || revokeTarget.value == null) return
  revokeBusy.value = true
  try {
    await revokeClientAuthorization(client.value.client_id, revokeTarget.value)
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to revoke'
  } finally {
    revokeBusy.value = false
    revokeOpen.value = false
    revokeTarget.value = null
  }
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div v-if="loading" class="text-sm text-[var(--app-muted)]">Loading client…</div>
    <div v-else-if="error && !client" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <template v-else-if="client && detail">
      <!-- Header -->
      <div class="flex items-center gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-5 py-4">
        <div class="size-12 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:shield" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <h1 class="text-xl font-semibold truncate">{{ client.name }}</h1>
          <div class="text-xs text-[var(--app-muted)] font-mono truncate">{{ client.client_id }}</div>
        </div>
        <span
          class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0"
          :class="client.active ? 'bg-emerald-500/15 text-emerald-600' : 'bg-[var(--app-surface)] text-[var(--app-muted)]'"
        >
          {{ client.active ? 'Active' : 'Inactive' }}
        </span>
      </div>

      <div v-if="error && client" class="flex items-start gap-2 text-sm text-red-500" role="alert">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </div>

      <!-- Info + Actions -->
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-2">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">CLIENT</div>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt class="text-[var(--app-muted)]">Redirect URI</dt>
            <dd class="font-mono text-xs truncate">{{ client.redirect_uri }}</dd>
            <dt class="text-[var(--app-muted)]">Description</dt>
            <dd>{{ client.description || '—' }}</dd>
            <dt class="text-[var(--app-muted)]">Active tokens</dt>
            <dd>{{ detail.active_tokens }}</dd>
            <dt class="text-[var(--app-muted)]">Total tokens</dt>
            <dd>{{ detail.total_tokens }}</dd>
            <dt class="text-[var(--app-muted)]">Created</dt>
            <dd>{{ fmtDateTime(client.created_at) }}</dd>
          </dl>
        </div>

        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">ACTIONS</div>
          <div class="flex flex-wrap gap-2">
            <button
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)] transition-colors"
              @click="openEdit"
            >
              <Icon icon="lucide:pencil" class="size-3.5" />
              Edit
            </button>
            <button
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)] transition-colors disabled:opacity-40"
              :disabled="toggleBusy"
              @click="toggleActive"
            >
              <Icon :icon="client.active ? 'lucide:circle-off' : 'lucide:circle-check'" class="size-3.5" />
              {{ client.active ? 'Disable' : 'Enable' }}
            </button>
            <button
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)] transition-colors"
              @click="regenConfirmOpen = true"
            >
              <Icon icon="lucide:refresh-cw" class="size-3.5" />
              Regenerate secret
            </button>
            <button
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
              @click="deleteOpen = true"
            >
              <Icon icon="lucide:trash-2" class="size-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <!-- Authorizations -->
      <div class="flex flex-col gap-2">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">
          AUTHORIZATIONS ({{ detail.authorizations.length }})
        </div>
        <div
          v-if="detail.authorizations.length"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
        >
          <div
            v-for="auth in detail.authorizations"
            :key="auth.user_id"
            class="flex items-center gap-4 px-5 py-3"
          >
            <div class="size-8 rounded-full grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] text-xs font-semibold shrink-0">
              <Icon icon="lucide:user" class="size-3.5" />
            </div>
            <div class="flex-1 min-w-0">
              <RouterLink
                :to="`/accounts/users/${auth.user_id}`"
                class="text-sm font-medium hover:text-[var(--app-accent)] transition-colors"
              >
                User #{{ auth.user_id }}
              </RouterLink>
            </div>
            <button
              class="text-xs font-medium text-[var(--app-muted)] hover:text-red-500 transition-colors"
              @click="promptRevoke(auth.user_id)"
            >
              Revoke
            </button>
          </div>
        </div>
        <div v-else class="text-sm text-[var(--app-muted)] px-5 py-3 rounded-xl border border-dashed border-[var(--app-border)]">
          No active authorizations.
        </div>
      </div>
    </template>

    <!-- Edit modal -->
    <Modal v-model:open="editOpen">
      <template #header>
        <h3 class="text-lg font-semibold">Edit client</h3>
      </template>
      <template #body>
        <form class="flex flex-col gap-3" @submit.prevent="submitEdit">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Name *</span>
            <input
              v-model="editForm.name"
              type="text"
              required
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Redirect URI *</span>
            <input
              v-model="editForm.redirect_uri"
              type="url"
              required
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] font-mono"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Description</span>
            <textarea
              v-model="editForm.description"
              rows="2"
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] resize-none"
            />
          </label>
          <p v-if="editError" class="text-xs text-red-500">{{ editError }}</p>
        </form>
      </template>
      <template #footer>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]"
            :disabled="editBusy"
            @click="editOpen = false"
          >Cancel</button>
          <button
            type="button"
            class="rounded-md bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            :disabled="editBusy"
            @click="submitEdit"
          >{{ editBusy ? 'Saving…' : 'Save changes' }}</button>
        </div>
      </template>
    </Modal>

    <!-- Regenerate-secret confirm -->
    <ConfirmationModal
      v-model="regenConfirmOpen"
      title="Regenerate secret"
      message="This revokes every access token and refresh token issued via this client. Existing integrations will break until they re-authorize with the new secret."
      confirm-text="Regenerate"
      confirm-color="error"
      :loading="regenBusy"
      @confirm="confirmRegen"
    />

    <!-- Regenerate-secret reveal -->
    <Modal v-model:open="regenRevealOpen">
      <template #header>
        <h3 class="text-lg font-semibold">New client secret</h3>
      </template>
      <template #body>
        <p class="text-sm text-[var(--app-muted)] mb-3">
          Copy the secret now — Construct does not store it in plaintext and can't show it again.
        </p>
        <div class="flex items-center gap-2">
          <code class="flex-1 rounded bg-[var(--app-surface)] px-2 py-1.5 text-xs font-mono truncate">{{ newSecret }}</code>
          <button
            class="size-7 grid place-items-center rounded text-[var(--app-muted)] hover:bg-[var(--app-card-hover)]"
            title="Copy"
            @click="newSecret && copyToClipboard(newSecret)"
          >
            <Icon icon="lucide:copy" class="size-3.5" />
          </button>
        </div>
      </template>
      <template #footer>
        <button
          type="button"
          class="rounded-md bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          @click="regenRevealOpen = false"
        >Done</button>
      </template>
    </Modal>

    <!-- Delete confirm -->
    <ConfirmationModal
      v-model="deleteOpen"
      title="Delete OAuth client"
      :message="`Permanently delete ${client?.name ?? 'this client'}? All access tokens and refresh tokens issued via it are revoked.`"
      confirm-text="Delete"
      confirm-color="error"
      :loading="deleteBusy"
      @confirm="confirmDelete"
    />

    <!-- Revoke authorization confirm -->
    <ConfirmationModal
      v-model="revokeOpen"
      title="Revoke authorization"
      :message="`Revoke User #${revokeTarget}'s access? Their tokens on this client will stop working immediately.`"
      confirm-text="Revoke"
      confirm-color="error"
      :loading="revokeBusy"
      @confirm="confirmRevoke"
    />
  </section>
</template>
