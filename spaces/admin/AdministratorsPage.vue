<script setup lang="ts">
import { ConfirmationModal, Modal } from '@construct-space/ui-web'
import { useAuthStore } from '@core/stores/auth'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, reactive, ref } from 'vue'
import {
  type Administrator,
  createAdministrator,
  deleteAdministrator,
  listAdministrators,
  setAdministratorPassword,
  updateAdministrator,
} from './api'

const auth = useAuthStore()
const admins = ref<Administrator[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

const canManage = computed(() => auth.user?.role === 'super_admin')
const selfId = computed(() => {
  const raw = (auth.user as { administrator_id?: number } | null)?.administrator_id
  return typeof raw === 'number' ? raw : null
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    admins.value = (await listAdministrators()).data
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load administrators'
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return admins.value
  return admins.value.filter(
    (a) =>
      `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.username.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q),
  )
})

function fullName(a: Administrator): string {
  return [a.first_name, a.last_name].filter(Boolean).join(' ') || a.username || a.email
}

function initials(a: Administrator): string {
  const base = fullName(a) || '?'
  return (
    base
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function roleBadge(role: string): string {
  switch (role) {
    case 'super_admin':
      return 'bg-amber-500/15 text-amber-600'
    case 'admin':
      return 'bg-sky-500/15 text-sky-600'
    default:
      return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
  }
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return 'Never'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

// ─── Create modal ────────────────────────────────────────────────────────
const createOpen = ref(false)
const createBusy = ref(false)
const createError = ref('')
const createForm = reactive({ email: '', first_name: '', last_name: '', username: '', password: '', role: 'admin' })

function openCreate() {
  Object.assign(createForm, { email: '', first_name: '', last_name: '', username: '', password: '', role: 'admin' })
  createError.value = ''
  createOpen.value = true
}

async function submitCreate() {
  createError.value = ''
  if (!createForm.email.trim() || !createForm.username.trim() || !createForm.password) {
    createError.value = 'Email, username, and password are required.'
    return
  }
  if (createForm.password.length < 8) {
    createError.value = 'Password must be at least 8 characters.'
    return
  }
  createBusy.value = true
  try {
    await createAdministrator({ ...createForm })
    createOpen.value = false
    await load()
  } catch (err) {
    createError.value = err instanceof Error ? err.message : 'Failed to create'
  } finally {
    createBusy.value = false
  }
}

// ─── Edit modal ──────────────────────────────────────────────────────────
const editOpen = ref(false)
const editBusy = ref(false)
const editError = ref('')
const editTarget = ref<Administrator | null>(null)
const editForm = reactive({ email: '', first_name: '', last_name: '', username: '', role: 'admin' })

function openEdit(admin: Administrator) {
  editTarget.value = admin
  editForm.email = admin.email
  editForm.first_name = admin.first_name
  editForm.last_name = admin.last_name
  editForm.username = admin.username
  editForm.role = admin.role
  editError.value = ''
  editOpen.value = true
}

async function submitEdit() {
  if (!editTarget.value) return
  editError.value = ''
  if (!editForm.email.trim()) {
    editError.value = 'Email is required.'
    return
  }
  editBusy.value = true
  try {
    await updateAdministrator(editTarget.value.id, { ...editForm })
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
async function toggleActive(admin: Administrator) {
  toggleBusy.value = true
  try {
    await updateAdministrator(admin.id, { active: !admin.active })
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to toggle'
  } finally {
    toggleBusy.value = false
  }
}

// ─── Password modal ──────────────────────────────────────────────────────
const pwdOpen = ref(false)
const pwdBusy = ref(false)
const pwdError = ref('')
const pwdTarget = ref<Administrator | null>(null)
const pwdValue = ref('')

function openPassword(admin: Administrator) {
  pwdTarget.value = admin
  pwdValue.value = ''
  pwdError.value = ''
  pwdOpen.value = true
}

async function submitPassword() {
  if (!pwdTarget.value) return
  pwdError.value = ''
  if (pwdValue.value.length < 8) {
    pwdError.value = 'At least 8 characters.'
    return
  }
  pwdBusy.value = true
  try {
    await setAdministratorPassword(pwdTarget.value.id, pwdValue.value)
    pwdOpen.value = false
  } catch (err) {
    pwdError.value = err instanceof Error ? err.message : 'Failed to update password'
  } finally {
    pwdBusy.value = false
  }
}

// ─── Delete confirm ──────────────────────────────────────────────────────
const deleteOpen = ref(false)
const deleteBusy = ref(false)
const deleteTarget = ref<Administrator | null>(null)

function promptDelete(admin: Administrator) {
  deleteTarget.value = admin
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleteBusy.value = true
  try {
    await deleteAdministrator(deleteTarget.value.id)
    deleteOpen.value = false
    deleteTarget.value = null
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete'
    deleteOpen.value = false
  } finally {
    deleteBusy.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Administrators</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Oracle staff accounts. Signed in as <strong class="text-[var(--app-foreground)]">{{ auth.user?.email }}</strong> ({{ auth.user?.role }}).
        </p>
      </div>
      <button
        v-if="canManage"
        type="button"
        class="inline-flex items-center gap-2 rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 transition-opacity shrink-0"
        @click="openCreate"
      >
        <Icon icon="lucide:user-plus" class="size-4" />
        <span>New administrator</span>
      </button>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search by name, email, username, or role…"
        class="w-full bg-transparent text-sm text-[var(--app-foreground)] outline-none placeholder:text-[var(--app-muted)]"
        aria-label="Filter administrators"
      />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !admins.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="filtered.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <div v-for="admin in filtered" :key="admin.id" class="flex items-center gap-4 px-5 py-3.5">
        <div class="size-9 rounded-full grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] text-xs font-semibold shrink-0">
          {{ initials(admin) }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium truncate">{{ fullName(admin) }}</span>
            <span v-if="admin.id === selfId" class="text-xs text-[var(--app-muted)]">(you)</span>
          </div>
          <div class="text-xs text-[var(--app-muted)] truncate">
            {{ admin.email }}<span v-if="admin.username"> · @{{ admin.username }}</span>
          </div>
        </div>
        <span class="text-xs text-[var(--app-muted)] w-32 shrink-0 hidden md:inline text-right">
          {{ fmtDateTime(admin.last_login) }}
        </span>
        <span class="inline-flex text-xs font-medium px-2 py-0.5 rounded shrink-0" :class="roleBadge(admin.role)">
          {{ admin.role }}
        </span>
        <span
          class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0"
          :class="admin.active ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-500'"
        >
          {{ admin.active ? 'Active' : 'Disabled' }}
        </span>
        <div v-if="canManage" class="flex items-center gap-1 shrink-0">
          <button
            class="size-7 grid place-items-center rounded text-[var(--app-muted)] hover:bg-[var(--app-card-hover)] hover:text-[var(--app-foreground)]"
            title="Edit"
            @click="openEdit(admin)"
          >
            <Icon icon="lucide:pencil" class="size-3.5" />
          </button>
          <button
            class="size-7 grid place-items-center rounded text-[var(--app-muted)] hover:bg-[var(--app-card-hover)] hover:text-[var(--app-foreground)]"
            title="Change password"
            @click="openPassword(admin)"
          >
            <Icon icon="lucide:key-round" class="size-3.5" />
          </button>
          <button
            class="size-7 grid place-items-center rounded text-[var(--app-muted)] hover:bg-[var(--app-card-hover)] hover:text-[var(--app-foreground)] disabled:opacity-30"
            :title="admin.id === selfId ? 'Cannot disable yourself' : (admin.active ? 'Disable' : 'Enable')"
            :disabled="admin.id === selfId || toggleBusy"
            @click="toggleActive(admin)"
          >
            <Icon :icon="admin.active ? 'lucide:user-x' : 'lucide:user-check'" class="size-3.5" />
          </button>
          <button
            class="size-7 grid place-items-center rounded text-[var(--app-muted)] hover:bg-red-500/10 hover:text-red-500 disabled:opacity-30"
            :title="admin.id === selfId ? 'Cannot delete yourself' : 'Delete'"
            :disabled="admin.id === selfId"
            @click="promptDelete(admin)"
          >
            <Icon icon="lucide:trash-2" class="size-3.5" />
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="!loading && !admins.length" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:shield-check" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No administrators yet</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Create the first super-admin and they'll appear here.
      </p>
    </div>

    <div v-else class="text-sm text-[var(--app-muted)] text-center py-8">
      No administrators match your search.
    </div>

    <!-- Create modal -->
    <Modal v-model:open="createOpen">
      <template #header>
        <h3 class="text-lg font-semibold">New administrator</h3>
      </template>
      <template #body>
        <form class="grid gap-3 md:grid-cols-2" @submit.prevent="submitCreate">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Email *</span>
            <input v-model="createForm.email" type="email" required class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Username *</span>
            <input v-model="createForm.username" type="text" required class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">First name</span>
            <input v-model="createForm.first_name" type="text" class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Last name</span>
            <input v-model="createForm.last_name" type="text" class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Password *</span>
            <input v-model="createForm.password" type="password" required autocomplete="new-password" class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Role</span>
            <select v-model="createForm.role" class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]">
              <option value="admin">admin</option>
              <option value="super_admin">super_admin</option>
              <option value="viewer">viewer</option>
            </select>
          </label>
          <p v-if="createError" class="col-span-full text-xs text-red-500">{{ createError }}</p>
        </form>
      </template>
      <template #footer>
        <div class="flex items-center gap-2">
          <button type="button" class="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]" :disabled="createBusy" @click="createOpen = false">Cancel</button>
          <button type="button" class="rounded-md bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40" :disabled="createBusy" @click="submitCreate">{{ createBusy ? 'Creating…' : 'Create' }}</button>
        </div>
      </template>
    </Modal>

    <!-- Edit modal -->
    <Modal v-model:open="editOpen">
      <template #header>
        <h3 class="text-lg font-semibold">Edit {{ editTarget ? fullName(editTarget) : 'administrator' }}</h3>
      </template>
      <template #body>
        <form class="grid gap-3 md:grid-cols-2" @submit.prevent="submitEdit">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Email *</span>
            <input v-model="editForm.email" type="email" required class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Username</span>
            <input v-model="editForm.username" type="text" class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">First name</span>
            <input v-model="editForm.first_name" type="text" class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Last name</span>
            <input v-model="editForm.last_name" type="text" class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]" />
          </label>
          <label class="flex flex-col gap-1 md:col-span-2">
            <span class="text-xs text-[var(--app-muted)]">Role</span>
            <select v-model="editForm.role" :disabled="editTarget?.id === selfId" class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] disabled:opacity-50">
              <option value="admin">admin</option>
              <option value="super_admin">super_admin</option>
              <option value="viewer">viewer</option>
            </select>
            <span v-if="editTarget?.id === selfId" class="text-xs text-[var(--app-muted)]">You cannot change your own role.</span>
          </label>
          <p v-if="editError" class="col-span-full text-xs text-red-500">{{ editError }}</p>
        </form>
      </template>
      <template #footer>
        <div class="flex items-center gap-2">
          <button type="button" class="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]" :disabled="editBusy" @click="editOpen = false">Cancel</button>
          <button type="button" class="rounded-md bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40" :disabled="editBusy" @click="submitEdit">{{ editBusy ? 'Saving…' : 'Save' }}</button>
        </div>
      </template>
    </Modal>

    <!-- Password modal -->
    <Modal v-model:open="pwdOpen">
      <template #header>
        <h3 class="text-lg font-semibold">Change password — {{ pwdTarget ? fullName(pwdTarget) : '' }}</h3>
      </template>
      <template #body>
        <p class="text-sm text-[var(--app-muted)] mb-3">
          Setting a new password revokes every active session for this administrator immediately. Share the new password through a trusted channel.
        </p>
        <form class="flex flex-col gap-3" @submit.prevent="submitPassword">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">New password *</span>
            <input v-model="pwdValue" type="password" required autocomplete="new-password" class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]" />
          </label>
          <p v-if="pwdError" class="text-xs text-red-500">{{ pwdError }}</p>
        </form>
      </template>
      <template #footer>
        <div class="flex items-center gap-2">
          <button type="button" class="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]" :disabled="pwdBusy" @click="pwdOpen = false">Cancel</button>
          <button type="button" class="rounded-md bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40" :disabled="pwdBusy" @click="submitPassword">{{ pwdBusy ? 'Saving…' : 'Set password' }}</button>
        </div>
      </template>
    </Modal>

    <!-- Delete confirm -->
    <ConfirmationModal
      v-model="deleteOpen"
      title="Delete administrator"
      :message="`Permanently delete ${deleteTarget ? fullName(deleteTarget) : 'this administrator'}? All their sessions will be revoked.`"
      confirm-text="Delete"
      confirm-color="error"
      :loading="deleteBusy"
      @confirm="confirmDelete"
    />
  </section>
</template>
