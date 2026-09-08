<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { listOrgMembers, type OrgMember } from './api'
import OrgHeader from './OrgHeader.vue'
import { useOrgContext } from './useOrgContext'

const route = useRoute()
const orgId = computed(() => String(route.params.id || ''))
const { detail, loading: orgLoading, error: orgError } = useOrgContext(orgId)

const members = ref<OrgMember[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

async function load() {
  if (!orgId.value) return
  loading.value = true
  error.value = ''
  try {
    members.value = (await listOrgMembers(orgId.value)).members
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load members'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(orgId, load)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return members.value
  return members.value.filter(
    (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.role.toLowerCase().includes(q),
  )
})

function initials(m: OrgMember): string {
  const parts = (m.name || m.email || '?').split(/\s+|@/).filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function roleBadge(role: string): string {
  if (role === 'owner' || role === 'Owner') return 'bg-amber-500/15 text-amber-600'
  if (role === 'admin' || role === 'Admin') return 'bg-sky-500/15 text-sky-600'
  return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
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

      <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
        <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
        <input
          v-model="search"
          type="text"
          placeholder="Search by name, email, or role…"
          class="w-full bg-transparent text-sm outline-none placeholder:text-[var(--app-muted)]"
        />
      </div>

      <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </div>

      <div v-if="loading && !members.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

      <div
        v-else-if="filtered.length"
        class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
      >
        <div v-for="member in filtered" :key="member.id" class="flex items-center gap-4 px-5 py-3">
          <div class="size-9 rounded-full grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] text-xs font-semibold shrink-0">
            {{ initials(member) }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ member.name || member.email }}</div>
            <div class="text-xs text-[var(--app-muted)] truncate">{{ member.email }}</div>
          </div>
          <span class="inline-flex text-xs font-medium px-2 py-0.5 rounded shrink-0" :class="roleBadge(member.role)">
            {{ member.role }}
          </span>
          <span
            v-if="member.status && member.status !== 'active'"
            class="inline-flex text-xs font-medium px-2 py-0.5 rounded bg-rose-500/15 text-rose-500 shrink-0"
          >
            {{ member.status }}
          </span>
        </div>
      </div>

      <div v-else class="text-sm text-[var(--app-muted)] text-center py-8">No members match your search.</div>
    </template>
  </section>
</template>
