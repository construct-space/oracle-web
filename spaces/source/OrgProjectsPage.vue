<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { listOrgProjects, type OrgProject } from './api'
import OrgHeader from './OrgHeader.vue'
import { useOrgContext } from './useOrgContext'

const route = useRoute()
const orgId = computed(() => String(route.params.id || ''))
const { detail, loading: orgLoading, error: orgError } = useOrgContext(orgId)

const projects = ref<OrgProject[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

async function load() {
  if (!orgId.value) return
  loading.value = true
  error.value = ''
  try {
    projects.value = (await listOrgProjects(orgId.value)).projects
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load projects'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(orgId, load)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return projects.value
  return projects.value.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.framework || '').toLowerCase().includes(q),
  )
})

function visibilityBadge(v: string): string {
  switch (v) {
    case 'public':
      return 'bg-emerald-500/15 text-emerald-600'
    case 'internal':
      return 'bg-sky-500/15 text-sky-600'
    case 'private':
      return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
    default:
      return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
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

      <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
        <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
        <input
          v-model="search"
          type="text"
          placeholder="Search by name, description, or framework…"
          class="w-full bg-transparent text-sm outline-none placeholder:text-[var(--app-muted)]"
        />
      </div>

      <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </div>

      <div v-if="loading && !projects.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

      <div
        v-else-if="filtered.length"
        class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
      >
        <div v-for="project in filtered" :key="project.id" class="flex items-center gap-4 px-5 py-3.5">
          <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
            <Icon icon="lucide:folder-kanban" class="size-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ project.name }}</div>
            <div class="text-xs text-[var(--app-muted)] truncate">
              {{ project.description || '—' }}<span v-if="project.framework"> · {{ project.framework }}</span>
            </div>
          </div>
          <div class="text-xs text-[var(--app-muted)] hidden md:flex items-center gap-3 shrink-0">
            <span>{{ project.member_count }} members</span>
            <span>{{ project.repo_count }} repos</span>
          </div>
          <span class="inline-flex text-xs font-medium px-2 py-0.5 rounded shrink-0" :class="visibilityBadge(project.visibility)">
            {{ project.visibility }}
          </span>
        </div>
      </div>

      <div v-else-if="!loading && !projects.length" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
        <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
          <Icon icon="lucide:folder-kanban" class="size-6" />
        </div>
        <div class="text-sm font-medium mt-3">No projects yet</div>
      </div>

      <div v-else class="text-sm text-[var(--app-muted)] text-center py-8">No projects match your search.</div>
    </template>
  </section>
</template>
