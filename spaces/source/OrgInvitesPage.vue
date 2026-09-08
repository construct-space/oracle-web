<script setup lang="ts">
import { ConfirmationModal } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { listOrgInvites, type OrgInvite, revokeInvite } from './api'
import OrgHeader from './OrgHeader.vue'
import { useOrgContext } from './useOrgContext'

const route = useRoute()
const orgId = computed(() => String(route.params.id || ''))
const { detail, loading: orgLoading, error: orgError, reload: reloadOrg } = useOrgContext(orgId)

const invites = ref<OrgInvite[]>([])
const loading = ref(false)
const error = ref('')
const statusFilter = ref('')

async function load() {
  if (!orgId.value) return
  loading.value = true
  error.value = ''
  try {
    invites.value = (await listOrgInvites(orgId.value, statusFilter.value || undefined)).invites
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load invites'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(orgId, load)
watch(statusFilter, load)

const confirmOpen = ref(false)
const confirmBusy = ref(false)
const pendingTarget = ref<OrgInvite | null>(null)

function promptRevoke(invite: OrgInvite) {
  pendingTarget.value = invite
  confirmOpen.value = true
}

async function confirmRevoke() {
  if (!pendingTarget.value) return
  confirmBusy.value = true
  try {
    await revokeInvite(pendingTarget.value.id)
    confirmOpen.value = false
    pendingTarget.value = null
    await load()
    await reloadOrg()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to revoke invite'
    confirmOpen.value = false
  } finally {
    confirmBusy.value = false
  }
}

function statusPill(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-sky-500/15 text-sky-600'
    case 'accepted':
      return 'bg-emerald-500/15 text-emerald-600'
    case 'revoked':
    case 'expired':
      return 'bg-rose-500/15 text-rose-500'
    default:
      return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div v-if="orgLoading && !detail" class="text-sm text-[var(--app-muted)]">Loading organization…</div>
    <div v-else-if="orgError && !detail" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ orgError }}</span>
    </div>

    <template v-else-if="detail">
      <OrgHeader :detail="detail" />

      <div class="flex flex-wrap items-center gap-2">
        <select
          v-model="statusFilter"
          class="text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2.5 py-1.5 text-[var(--app-foreground)]"
          aria-label="Status filter"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="revoked">Revoked</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </div>

      <div v-if="loading && !invites.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

      <div
        v-else-if="invites.length"
        class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
      >
        <div v-for="invite in invites" :key="invite.id" class="flex items-center gap-4 px-5 py-3">
          <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
            <Icon icon="lucide:mail-plus" class="size-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ invite.email }}</div>
            <div class="text-xs text-[var(--app-muted)] truncate">
              {{ invite.role }} · expires {{ fmtDate(invite.expires_at) }}
            </div>
          </div>
          <span class="inline-flex text-xs font-medium px-2 py-0.5 rounded shrink-0" :class="statusPill(invite.status)">
            {{ invite.status }}
          </span>
          <button
            v-if="invite.status === 'pending'"
            class="text-xs font-medium text-[var(--app-muted)] hover:text-red-500 transition-colors"
            @click="promptRevoke(invite)"
          >
            Revoke
          </button>
        </div>
      </div>

      <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
        <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
          <Icon icon="lucide:mail-plus" class="size-6" />
        </div>
        <div class="text-sm font-medium mt-3">No invites</div>
      </div>
    </template>

    <ConfirmationModal
      v-model="confirmOpen"
      title="Revoke invite"
      :message="`Revoke the invite for ${pendingTarget?.email ?? ''}? They won't be able to accept it after this.`"
      confirm-text="Revoke"
      confirm-color="error"
      :loading="confirmBusy"
      @confirm="confirmRevoke"
    />
  </section>
</template>
