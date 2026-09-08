<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import OrgHeader from './OrgHeader.vue'
import { useOrgContext } from './useOrgContext'

const route = useRoute()
const orgId = computed(() => String(route.params.id || ''))
const { detail, loading, error } = useOrgContext(orgId)

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div v-if="loading && !detail" class="text-sm text-[var(--app-muted)]">Loading organization…</div>
    <div v-else-if="error && !detail" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <template v-else-if="detail">
      <OrgHeader :detail="detail" />

      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-2">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">IDENTITY</div>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt class="text-[var(--app-muted)]">Org ID</dt>
            <dd class="font-mono text-xs truncate">{{ detail.data.id }}</dd>
            <dt class="text-[var(--app-muted)]">Owner</dt>
            <dd>
              <span v-if="detail.owner">{{ detail.owner.name }} · {{ detail.owner.email }}</span>
              <span v-else class="text-[var(--app-muted)]">—</span>
            </dd>
            <dt class="text-[var(--app-muted)]">Developer</dt>
            <dd>{{ detail.data.developer_status || 'none' }}</dd>
            <dt class="text-[var(--app-muted)]">Created</dt>
            <dd>{{ fmtDateTime(detail.data.created_at) }}</dd>
            <dt class="text-[var(--app-muted)]">Updated</dt>
            <dd>{{ fmtDateTime(detail.data.updated_at) }}</dd>
          </dl>
        </div>

        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">AT A GLANCE</div>
          <div class="grid grid-cols-2 gap-3">
            <RouterLink :to="`/source/organizations/${detail.data.id}/members`" class="rounded-lg border border-[var(--app-border)] p-3 hover:bg-[var(--app-card-hover)]">
              <div class="text-2xl font-semibold">{{ detail.member_count }}</div>
              <div class="text-xs text-[var(--app-muted)]">Members</div>
            </RouterLink>
            <RouterLink :to="`/source/organizations/${detail.data.id}/projects`" class="rounded-lg border border-[var(--app-border)] p-3 hover:bg-[var(--app-card-hover)]">
              <div class="text-2xl font-semibold">{{ detail.project_count }}</div>
              <div class="text-xs text-[var(--app-muted)]">Projects</div>
            </RouterLink>
            <RouterLink :to="`/source/organizations/${detail.data.id}/teams`" class="rounded-lg border border-[var(--app-border)] p-3 hover:bg-[var(--app-card-hover)]">
              <div class="text-2xl font-semibold">{{ detail.team_count }}</div>
              <div class="text-xs text-[var(--app-muted)]">Teams</div>
            </RouterLink>
            <RouterLink :to="`/source/organizations/${detail.data.id}/invites`" class="rounded-lg border border-[var(--app-border)] p-3 hover:bg-[var(--app-card-hover)]">
              <div class="text-2xl font-semibold">{{ detail.pending_invite_count }}</div>
              <div class="text-xs text-[var(--app-muted)]">Pending invites</div>
            </RouterLink>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
