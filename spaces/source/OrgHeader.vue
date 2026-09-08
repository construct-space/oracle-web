<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import type { OrgDetail } from './api'
import OrgSubnav from './OrgSubnav.vue'

defineProps<{ detail: OrgDetail }>()
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-5 py-4">
      <div class="size-12 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
        <Icon :icon="`lucide:${detail.data.icon || 'building-2'}`" class="size-5" />
      </div>
      <div class="flex-1 min-w-0">
        <h1 class="text-xl font-semibold truncate">{{ detail.data.name }}</h1>
        <div class="text-xs text-[var(--app-muted)] font-mono truncate">{{ detail.data.slug }}</div>
      </div>
      <span
        v-if="detail.data.developer_status && detail.data.developer_status !== 'none'"
        class="inline-flex text-xs font-medium px-2.5 py-1 rounded bg-violet-500/15 text-violet-600 shrink-0"
      >
        developer:{{ detail.data.developer_status }}
      </span>
    </div>

    <OrgSubnav
      :org-id="detail.data.id"
      :member-count="detail.member_count"
      :project-count="detail.project_count"
      :team-count="detail.team_count"
      :pending-invite-count="detail.pending_invite_count"
    />
  </div>
</template>
