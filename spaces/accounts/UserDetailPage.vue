<script setup lang="ts">
import { ConfirmationModal } from '@construct-space/ui-web'
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  type AccountUserDetail,
  type ConstructBalance,
  type ConstructLedgerRow,
  blockConstructUser,
  getConstructUser,
  getUser,
  grantConstructCredits,
  postAccountAdmin,
  unblockConstructUser,
} from './api'

const route = useRoute()
const loading = ref(false)
const acting = ref(false)
const error = ref('')
const detail = ref<AccountUserDetail | null>(null)

interface PendingAction {
  path: string
  method: 'POST' | 'DELETE'
  title: string
  message: string
  confirmText: string
  destructive: boolean
}
const confirmOpen = ref(false)
const pending = ref<PendingAction | null>(null)

const userId = computed(() => String(route.params.id || ''))
const user = computed(() => detail.value?.data ?? null)

const fullName = computed(() => {
  const u = user.value
  if (!u) return ''
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username
})

const initials = computed(() => {
  const base = (fullName.value || user.value?.email || '?').trim()
  const parts = base.split(/\s+|@/).filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
})

async function load() {
  if (!userId.value) return
  loading.value = true
  error.value = ''
  try {
    detail.value = await getUser(userId.value)
    // Construct credits — fetched separately because provider-api is a
    // distinct service. Failure here is non-fatal; the user might not
    // have a balance row yet (no chat calls made).
    void loadConstruct()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load user'
  } finally {
    loading.value = false
  }
}

// ─── Construct credits state ────────────────────────────────────────────────

const constructBalance = ref<ConstructBalance | null>(null)
const constructLedger = ref<ConstructLedgerRow[]>([])
const constructLoading = ref(false)
const constructError = ref('')
const constructActing = ref(false)
const grantDelta = ref<number>(50)
const grantReason = ref<string>('')
const blockReason = ref<string>('')

async function loadConstruct() {
  const uuid = user.value?.uuid
  if (!uuid) return
  constructLoading.value = true
  constructError.value = ''
  try {
    const res = await getConstructUser(uuid)
    constructBalance.value = res.balance
    constructLedger.value = res.ledger
  } catch (err) {
    // 404 = no balance row yet (first chat will create it). Surface
    // only real errors.
    const msg = err instanceof Error ? err.message : String(err)
    if (!/not\s*found|404/i.test(msg)) {
      constructError.value = msg
    } else {
      constructBalance.value = null
      constructLedger.value = []
    }
  } finally {
    constructLoading.value = false
  }
}

async function grantCredits() {
  const uuid = user.value?.uuid
  if (!uuid || !grantDelta.value) return
  constructActing.value = true
  constructError.value = ''
  try {
    await grantConstructCredits(uuid, grantDelta.value, grantReason.value)
    grantDelta.value = 50
    grantReason.value = ''
    await loadConstruct()
  } catch (err) {
    constructError.value = err instanceof Error ? err.message : 'Grant failed'
  } finally {
    constructActing.value = false
  }
}

async function blockConstruct() {
  const uuid = user.value?.uuid
  if (!uuid) return
  constructActing.value = true
  constructError.value = ''
  try {
    await blockConstructUser(uuid, blockReason.value || 'Blocked by staff')
    blockReason.value = ''
    await loadConstruct()
  } catch (err) {
    constructError.value = err instanceof Error ? err.message : 'Block failed'
  } finally {
    constructActing.value = false
  }
}

async function unblockConstruct() {
  const uuid = user.value?.uuid
  if (!uuid) return
  constructActing.value = true
  constructError.value = ''
  try {
    await unblockConstructUser(uuid)
    await loadConstruct()
  } catch (err) {
    constructError.value = err instanceof Error ? err.message : 'Unblock failed'
  } finally {
    constructActing.value = false
  }
}

function promptAction(action: PendingAction) {
  pending.value = action
  confirmOpen.value = true
}

async function runPending() {
  const action = pending.value
  if (!action) return
  acting.value = true
  error.value = ''
  try {
    await postAccountAdmin(action.path, action.method)
    confirmOpen.value = false
    pending.value = null
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Action failed'
    confirmOpen.value = false
  } finally {
    acting.value = false
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

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div v-if="loading" class="text-sm text-[var(--app-muted)]">Loading user…</div>
    <div v-else-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <template v-else-if="user && detail">
      <!-- Identity header -->
      <div class="flex items-center gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-5 py-4">
        <div class="size-12 rounded-full grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] text-sm font-semibold shrink-0">
          {{ initials }}
        </div>
        <div class="flex-1 min-w-0">
          <h1 class="text-xl font-semibold truncate">{{ fullName }}</h1>
          <div class="text-sm text-[var(--app-muted)] truncate">@{{ user.username }} · {{ user.email }}</div>
        </div>
        <span
          class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0"
          :class="user.suspended ? 'bg-rose-500/15 text-rose-500' : user.totp_enabled ? 'bg-sky-500/15 text-sky-500' : 'bg-emerald-500/15 text-emerald-600'"
        >
          {{ user.suspended ? 'Suspended' : user.totp_enabled ? '2FA enabled' : 'Active' }}
        </span>
      </div>

      <!-- State + admin actions -->
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-2">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">STATE</div>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt class="text-[var(--app-muted)]">UUID</dt>
            <dd class="font-mono text-xs truncate">{{ user.uuid }}</dd>
            <dt class="text-[var(--app-muted)]">Developer</dt>
            <dd>{{ user.developer_status || '—' }}</dd>
            <dt class="text-[var(--app-muted)]">Last login</dt>
            <dd>{{ fmtDateTime(user.last_login) }}</dd>
            <dt class="text-[var(--app-muted)]">Created</dt>
            <dd>{{ fmtDateTime(user.created_at) }}</dd>
          </dl>
        </div>

        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">ADMIN ACTIONS</div>
          <div class="flex flex-wrap gap-2">
            <button
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)] transition-colors disabled:opacity-40"
              :disabled="acting"
              @click="promptAction({
                path: `/api/accounts/admin/users/${user.id}/${user.suspended ? 'unsuspend' : 'suspend'}`,
                method: 'POST',
                title: user.suspended ? 'Unsuspend user' : 'Suspend user',
                message: user.suspended
                  ? `Restore access for ${fullName}? They will be able to log in and use the platform again.`
                  : `Suspend ${fullName}? They will be blocked from logging in until you unsuspend them.`,
                confirmText: user.suspended ? 'Unsuspend' : 'Suspend',
                destructive: !user.suspended,
              })"
            >
              <Icon :icon="user.suspended ? 'lucide:user-check' : 'lucide:user-x'" class="size-3.5" />
              {{ user.suspended ? 'Unsuspend' : 'Suspend' }}
            </button>
            <button
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)] transition-colors disabled:opacity-40"
              :disabled="acting"
              @click="promptAction({
                path: `/api/accounts/admin/users/${user.id}/force-logout`,
                method: 'POST',
                title: 'Force logout',
                message: `Revoke every active session for ${fullName}? They will need to log in again on all devices.`,
                confirmText: 'Force logout',
                destructive: true,
              })"
            >
              <Icon icon="lucide:log-out" class="size-3.5" />
              Force logout
            </button>
            <button
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)] transition-colors disabled:opacity-40"
              :disabled="acting"
              @click="promptAction({
                path: `/api/accounts/admin/users/${user.id}/force-password-reset`,
                method: 'POST',
                title: 'Force password reset',
                message: `Force ${fullName} to set a new password on next login?`,
                confirmText: 'Force reset',
                destructive: true,
              })"
            >
              <Icon icon="lucide:key-round" class="size-3.5" />
              Reset password
            </button>
            <button
              v-if="user.totp_enabled"
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)] transition-colors disabled:opacity-40"
              :disabled="acting"
              @click="promptAction({
                path: `/api/accounts/admin/users/${user.id}/reset-2fa`,
                method: 'POST',
                title: 'Reset 2FA',
                message: `Disable TOTP for ${fullName}? They will need to set up 2FA again.`,
                confirmText: 'Reset 2FA',
                destructive: true,
              })"
            >
              <Icon icon="lucide:shield-off" class="size-3.5" />
              Reset 2FA
            </button>
          </div>
        </div>
      </div>

      <!-- Construct credits -->
      <div class="flex flex-col gap-2">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">CONSTRUCT CREDITS</div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-4">
          <div v-if="constructError" class="text-xs text-red-500">{{ constructError }}</div>
          <div v-if="constructLoading" class="text-sm text-[var(--app-muted)]">Loading credits…</div>

          <template v-else>
            <!-- Balance summary -->
            <dl v-if="constructBalance" class="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt class="text-xs text-[var(--app-muted)] tracking-wider">DAILY USED</dt>
                <dd class="mt-1 font-mono tabular-nums">{{ constructBalance.daily_used }}</dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--app-muted)] tracking-wider">PAID BALANCE</dt>
                <dd class="mt-1 font-mono tabular-nums">{{ constructBalance.paid_balance }}</dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--app-muted)] tracking-wider">STATUS</dt>
                <dd class="mt-1">
                  <span
                    v-if="constructBalance.blocked"
                    class="inline-flex text-xs px-2 py-0.5 rounded bg-rose-500/15 text-rose-500"
                  >Blocked</span>
                  <span v-else class="inline-flex text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600">Active</span>
                </dd>
              </div>
            </dl>
            <div v-else class="text-sm text-[var(--app-muted)] italic">No balance yet — created on first chat call.</div>

            <div v-if="constructBalance?.blocked && constructBalance.blocked_reason" class="text-xs text-rose-500/80">
              Reason: {{ constructBalance.blocked_reason }}
            </div>

            <!-- Grant credits -->
            <div class="flex flex-wrap items-end gap-2 pt-2 border-t border-[var(--app-border)]/40">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-[var(--app-muted)]">Grant credits</label>
                <input
                  v-model.number="grantDelta"
                  type="number"
                  step="1"
                  class="w-24 rounded border border-[var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-sm font-mono tabular-nums"
                />
              </div>
              <div class="flex-1 min-w-[200px] flex flex-col gap-1">
                <label class="text-xs text-[var(--app-muted)]">Reason</label>
                <input
                  v-model="grantReason"
                  type="text"
                  placeholder="e.g. early access, beta tester"
                  class="w-full rounded border border-[var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-sm"
                />
              </div>
              <button
                class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)] transition-colors disabled:opacity-40"
                :disabled="constructActing || !grantDelta"
                @click="grantCredits"
              >
                <Icon icon="lucide:plus-circle" class="size-3.5" />
                Grant
              </button>
            </div>

            <!-- Block / unblock -->
            <div class="flex flex-wrap items-end gap-2 pt-2 border-t border-[var(--app-border)]/40">
              <template v-if="!constructBalance?.blocked">
                <div class="flex-1 min-w-[200px] flex flex-col gap-1">
                  <label class="text-xs text-[var(--app-muted)]">Block Construct usage</label>
                  <input
                    v-model="blockReason"
                    type="text"
                    placeholder="Reason (shown to user)"
                    class="w-full rounded border border-[var(--app-border)] bg-[var(--app-card)] px-2 py-1 text-sm"
                  />
                </div>
                <button
                  class="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                  :disabled="constructActing"
                  @click="blockConstruct"
                >
                  <Icon icon="lucide:ban" class="size-3.5" />
                  Block
                </button>
              </template>
              <button
                v-else
                class="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                :disabled="constructActing"
                @click="unblockConstruct"
              >
                <Icon icon="lucide:check-circle" class="size-3.5" />
                Unblock
              </button>
            </div>

            <!-- Recent ledger -->
            <div v-if="constructLedger.length" class="flex flex-col gap-1 pt-2 border-t border-[var(--app-border)]/40">
              <div class="text-xs text-[var(--app-muted)] tracking-wider">RECENT LEDGER ({{ constructLedger.length }})</div>
              <div class="divide-y divide-[color:var(--app-border)]/40">
                <div
                  v-for="row in constructLedger.slice(0, 10)"
                  :key="row.id"
                  class="flex items-center gap-3 py-1.5 text-xs"
                >
                  <span class="font-mono tabular-nums w-16 text-right" :class="row.delta < 0 ? 'text-rose-500' : 'text-emerald-600'">
                    {{ row.delta > 0 ? '+' : '' }}{{ row.delta }}
                  </span>
                  <span class="font-mono text-[var(--app-muted)] w-32 truncate">{{ row.kind }}</span>
                  <span class="text-[var(--app-muted)] flex-1 truncate" :title="row.meta">{{ row.meta || '' }}</span>
                  <span class="text-[var(--app-muted)] text-[10px] tabular-nums">{{ fmtDateTime(row.created_at) }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Sessions -->
      <div class="flex flex-col gap-2">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">SESSIONS ({{ detail.sessions.length }})</div>
        <div
          v-if="detail.sessions.length"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
        >
          <div
            v-for="session in detail.sessions"
            :key="session.id"
            class="flex items-center gap-4 px-5 py-3.5"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ session.user_agent || 'Unknown device' }}</div>
              <div class="text-xs text-[var(--app-muted)]">
                {{ session.ip_address || '—' }} · expires {{ fmtDateTime(session.expires_at) }}
              </div>
            </div>
            <button
              class="text-xs font-medium text-[var(--app-muted)] hover:text-red-500 transition-colors disabled:opacity-40"
              :disabled="acting"
              @click="promptAction({
                path: `/api/accounts/admin/sessions/${session.id}`,
                method: 'DELETE',
                title: 'Revoke session',
                message: `Revoke session #${session.id}? The user will be signed out on that device.`,
                confirmText: 'Revoke',
                destructive: true,
              })"
            >
              Revoke
            </button>
          </div>
        </div>
        <div v-else class="text-sm text-[var(--app-muted)] px-5 py-3 rounded-xl border border-dashed border-[var(--app-border)]">
          No sessions.
        </div>
      </div>

      <!-- Passkeys -->
      <div class="flex flex-col gap-2">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">PASSKEYS ({{ detail.passkeys.length }})</div>
        <div
          v-if="detail.passkeys.length"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
        >
          <div
            v-for="passkey in detail.passkeys"
            :key="passkey.id"
            class="flex items-center gap-4 px-5 py-3.5"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ passkey.name || `Passkey #${passkey.id}` }}</div>
              <div class="text-xs text-[var(--app-muted)]">Last used {{ fmtDateTime(passkey.last_used_at) }}</div>
            </div>
            <button
              class="text-xs font-medium text-[var(--app-muted)] hover:text-red-500 transition-colors disabled:opacity-40"
              :disabled="acting"
              @click="promptAction({
                path: `/api/accounts/admin/passkeys/${passkey.id}`,
                method: 'DELETE',
                title: 'Revoke passkey',
                message: `Revoke ${passkey.name || `passkey #${passkey.id}`}? The user won't be able to sign in with it anymore.`,
                confirmText: 'Revoke',
                destructive: true,
              })"
            >
              Revoke
            </button>
          </div>
        </div>
        <div v-else class="text-sm text-[var(--app-muted)] px-5 py-3 rounded-xl border border-dashed border-[var(--app-border)]">
          No passkeys.
        </div>
      </div>
    </template>

    <ConfirmationModal
      v-model="confirmOpen"
      :title="pending?.title ?? 'Confirm'"
      :message="pending?.message ?? ''"
      :confirm-text="pending?.confirmText ?? 'Confirm'"
      :confirm-color="pending?.destructive ? 'error' : 'primary'"
      :loading="acting"
      @confirm="runPending"
    />
  </section>
</template>
