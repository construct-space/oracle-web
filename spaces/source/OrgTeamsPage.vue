<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { listOrgTeams, type OrgTeam } from './api'
import OrgHeader from './OrgHeader.vue'
import { useOrgContext } from './useOrgContext'

const route = useRoute()
const orgId = computed(() => String(route.params.id || ''))
const { detail, loading: orgLoading, error: orgError } = useOrgContext(orgId)

const teams = ref<OrgTeam[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

async function load() {
  if (!orgId.value) return
  loading.value = true
  error.value = ''
  try {
    teams.value = (await listOrgTeams(orgId.value)).teams
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load teams'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(orgId, load)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return teams.value
  return teams.value.filter((t) => t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
})
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
          placeholder="Search teams…"
          class="w-full bg-transparent text-sm outline-none placeholder:text-[var(--app-muted)]"
        />
      </div>

      <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </div>

      <div v-if="loading && !teams.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

      <div
        v-else-if="filtered.length"
        class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
      >
        <div v-for="team in filtered" :key="team.id" class="flex items-center gap-4 px-5 py-3.5">
          <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
            <Icon icon="lucide:users-round" class="size-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ team.name }}</div>
            <div class="text-xs text-[var(--app-muted)] truncate">{{ team.description || '—' }}</div>
          </div>
          <span class="text-xs text-[var(--app-muted)] shrink-0">{{ team.member_count }} members</span>
        </div>
      </div>

      <div v-else-if="!loading && !teams.length" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
        <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
          <Icon icon="lucide:users-round" class="size-6" />
        </div>
        <div class="text-sm font-medium mt-3">No teams yet</div>
      </div>

      <div v-else class="text-sm text-[var(--app-muted)] text-center py-8">No teams match your search.</div>
    </template>
  </section>
</template>
