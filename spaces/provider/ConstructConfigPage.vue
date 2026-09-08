<script setup lang="ts">
import { Button, Icon, Input } from '@construct-space/ui-web'
import { onMounted, ref } from 'vue'
import {
  type ConstructBalance,
  type ConstructConfig,
  type ConstructLedgerRow,
  blockConstructUser,
  getConstructConfig,
  getConstructUser,
  grantConstructCredits,
  unblockConstructUser,
  updateConstructConfig,
} from './api'

const loading = ref(false)
const error = ref('')
const saving = ref(false)
const config = ref<ConstructConfig | null>(null)
const form = ref<{ daily_allowance: number; enabled: boolean }>({ daily_allowance: 100, enabled: true })

const userQuery = ref('')
const userLoading = ref(false)
const userError = ref('')
const balance = ref<ConstructBalance | null>(null)
const ledger = ref<ConstructLedgerRow[]>([])
const grantAmount = ref(0)
const grantReason = ref('')
const blockReason = ref('')

async function loadConfig() {
  loading.value = true
  error.value = ''
  try {
    const r = await getConstructConfig()
    config.value = r.config
    form.value = { daily_allowance: r.config.daily_allowance, enabled: r.config.enabled }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  error.value = ''
  try {
    const r = await updateConstructConfig({ ...form.value })
    config.value = r.config
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

async function loadUser() {
  if (!userQuery.value.trim()) return
  userLoading.value = true
  userError.value = ''
  try {
    const r = await getConstructUser(userQuery.value.trim())
    balance.value = r.balance
    ledger.value = r.ledger
  } catch (e) {
    userError.value = e instanceof Error ? e.message : String(e)
  } finally {
    userLoading.value = false
  }
}

async function doGrant() {
  if (!balance.value || grantAmount.value === 0) return
  try {
    const r = await grantConstructCredits(balance.value.user_id, grantAmount.value, grantReason.value)
    balance.value = r.balance
    grantAmount.value = 0
    grantReason.value = ''
    await loadUser()
  } catch (e) {
    userError.value = e instanceof Error ? e.message : String(e)
  }
}

async function doBlock() {
  if (!balance.value) return
  try {
    await blockConstructUser(balance.value.user_id, blockReason.value)
    blockReason.value = ''
    await loadUser()
  } catch (e) {
    userError.value = e instanceof Error ? e.message : String(e)
  }
}

async function doUnblock() {
  if (!balance.value) return
  try {
    await unblockConstructUser(balance.value.user_id)
    await loadUser()
  } catch (e) {
    userError.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(loadConfig)
</script>

<template>
  <section class="space-y-6">
    <header>
      <h1 class="text-xl font-semibold text-[var(--app-foreground)]">Construct — Credit Settings</h1>
      <p class="text-sm text-[var(--app-muted)]">Global allowance + per-user management. Reset is lazy at UTC midnight.</p>
    </header>

    <div v-if="error" class="rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600">{{ error }}</div>

    <!-- Global config -->
    <div class="rounded border border-[color:var(--app-border)] p-5 space-y-4 bg-[var(--app-card)]">
      <h2 class="text-sm font-semibold uppercase tracking-wider text-[var(--app-muted)]">Global</h2>
      <div class="grid grid-cols-2 gap-4 max-w-xl">
        <label class="space-y-1">
          <span class="text-xs text-[var(--app-muted)]">Daily allowance (credits / user / day)</span>
          <Input v-model.number="form.daily_allowance" type="number" />
        </label>
        <label class="flex items-end gap-2 pb-1">
          <input v-model="form.enabled" type="checkbox" />
          <span class="text-sm">Construct provider enabled</span>
        </label>
      </div>
      <Button color="primary" size="sm" :label="saving ? 'Saving...' : 'Save'" :disabled="saving" @click="saveConfig" />
    </div>

    <!-- Per-user -->
    <div class="rounded border border-[color:var(--app-border)] p-5 space-y-4 bg-[var(--app-card)]">
      <h2 class="text-sm font-semibold uppercase tracking-wider text-[var(--app-muted)]">User lookup</h2>

      <div class="flex gap-2 items-end">
        <label class="space-y-1 flex-1 max-w-md">
          <span class="text-xs text-[var(--app-muted)]">User ID (UUID)</span>
          <Input v-model="userQuery" placeholder="00000000-0000-0000-0000-000000000000" />
        </label>
        <Button color="primary" size="sm" :label="userLoading ? 'Loading...' : 'Load'" :disabled="userLoading || !userQuery" @click="loadUser" />
      </div>

      <div v-if="userError" class="rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600">{{ userError }}</div>

      <div v-if="balance" class="space-y-4">
        <div class="grid grid-cols-4 gap-4 text-sm">
          <div class="space-y-0.5">
            <div class="text-xs uppercase text-[var(--app-muted)]">Daily used</div>
            <div class="text-lg tabular-nums">{{ balance.daily_used }}</div>
          </div>
          <div class="space-y-0.5">
            <div class="text-xs uppercase text-[var(--app-muted)]">Daily date</div>
            <div class="text-xs font-mono">{{ balance.daily_date }}</div>
          </div>
          <div class="space-y-0.5">
            <div class="text-xs uppercase text-[var(--app-muted)]">Paid balance</div>
            <div class="text-lg tabular-nums">{{ balance.paid_balance }}</div>
          </div>
          <div class="space-y-0.5">
            <div class="text-xs uppercase text-[var(--app-muted)]">Status</div>
            <div v-if="balance.blocked" class="inline-flex items-center gap-1 text-red-600 text-sm">
              <Icon icon="lucide:lock" class="size-4" /> Blocked
            </div>
            <div v-else class="inline-flex items-center gap-1 text-emerald-600 text-sm">
              <Icon icon="lucide:check" class="size-4" /> Active
            </div>
          </div>
        </div>
        <p v-if="balance.blocked && balance.blocked_reason" class="text-xs text-[var(--app-muted)]">
          Reason: {{ balance.blocked_reason }}
        </p>

        <!-- Grant -->
        <div class="space-y-2 border-t border-[color:var(--app-border)] pt-4">
          <h3 class="text-xs uppercase text-[var(--app-muted)]">Grant credits</h3>
          <div class="flex gap-2 items-end">
            <label class="space-y-1 w-40">
              <span class="text-xs text-[var(--app-muted)]">Delta (+ / -)</span>
              <Input v-model.number="grantAmount" type="number" />
            </label>
            <label class="space-y-1 flex-1">
              <span class="text-xs text-[var(--app-muted)]">Reason</span>
              <Input v-model="grantReason" placeholder="e.g. ops compensation for outage" />
            </label>
            <Button color="primary" size="sm" label="Apply" :disabled="grantAmount === 0" @click="doGrant" />
          </div>
        </div>

        <!-- Block / unblock -->
        <div class="space-y-2 border-t border-[color:var(--app-border)] pt-4">
          <h3 class="text-xs uppercase text-[var(--app-muted)]">Access</h3>
          <div v-if="!balance.blocked" class="flex gap-2 items-end">
            <label class="space-y-1 flex-1">
              <span class="text-xs text-[var(--app-muted)]">Block reason</span>
              <Input v-model="blockReason" placeholder="abuse / TOS violation" />
            </label>
            <Button color="error" size="sm" label="Block" @click="doBlock" />
          </div>
          <div v-else>
            <Button color="primary" size="sm" label="Unblock" @click="doUnblock" />
          </div>
        </div>

        <!-- Ledger -->
        <div class="space-y-2 border-t border-[color:var(--app-border)] pt-4">
          <h3 class="text-xs uppercase text-[var(--app-muted)]">Recent ledger (last 50)</h3>
          <div class="overflow-x-auto rounded border border-[color:var(--app-border)]">
            <table class="min-w-full text-xs">
              <thead class="bg-[var(--app-card-hover)]">
                <tr>
                  <th class="text-left text-xs font-medium text-[var(--app-muted)] px-3 py-1.5">When</th>
                  <th class="text-left text-xs font-medium text-[var(--app-muted)] px-3 py-1.5">Kind</th>
                  <th class="text-right text-xs font-medium text-[var(--app-muted)] px-3 py-1.5">Δ</th>
                  <th class="text-left text-xs font-medium text-[var(--app-muted)] px-3 py-1.5">Prompt</th>
                  <th class="text-left text-xs font-medium text-[var(--app-muted)] px-3 py-1.5">Meta</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[color:var(--app-border)]">
                <tr v-for="row in ledger" :key="row.id">
                  <td class="px-3 py-1.5 font-mono text-[var(--app-muted)]">{{ row.created_at }}</td>
                  <td class="px-3 py-1.5">{{ row.kind }}</td>
                  <td class="px-3 py-1.5 text-right tabular-nums" :class="row.delta < 0 ? 'text-red-600' : 'text-emerald-600'">
                    {{ row.delta > 0 ? `+${row.delta}` : row.delta }}
                  </td>
                  <td class="px-3 py-1.5 font-mono text-[var(--app-muted)]">{{ row.prompt_id }}</td>
                  <td class="px-3 py-1.5 font-mono text-[var(--app-muted)] truncate max-w-md">{{ row.meta }}</td>
                </tr>
                <tr v-if="ledger.length === 0">
                  <td colspan="5" class="px-3 py-4 text-center text-[var(--app-muted)]">No history.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
