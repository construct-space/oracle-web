<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { RouterLink, useRoute } from 'vue-router'

const props = defineProps<{
  orgId: string
  memberCount?: number
  projectCount?: number
  teamCount?: number
  pendingInviteCount?: number
}>()

const route = useRoute()

interface Tab {
  id: string
  label: string
  icon: string
  path: string
  count?: number
}

function tabs(): Tab[] {
  const base = `/source/organizations/${props.orgId}`
  return [
    { id: 'overview', label: 'Overview', icon: 'lucide:home', path: base },
    { id: 'members', label: 'Members', icon: 'lucide:users', path: `${base}/members`, count: props.memberCount },
    {
      id: 'projects',
      label: 'Projects',
      icon: 'lucide:folder-kanban',
      path: `${base}/projects`,
      count: props.projectCount,
    },
    { id: 'teams', label: 'Teams', icon: 'lucide:users-round', path: `${base}/teams`, count: props.teamCount },
    {
      id: 'invites',
      label: 'Invites',
      icon: 'lucide:mail-plus',
      path: `${base}/invites`,
      count: props.pendingInviteCount,
    },
  ]
}

function isActive(tab: Tab): boolean {
  return route.path === tab.path
}
</script>

<template>
  <nav class="flex items-center gap-1 border-b border-[var(--app-border)]">
    <RouterLink
      v-for="tab in tabs()"
      :key="tab.id"
      :to="tab.path"
      class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
      :class="isActive(tab)
        ? 'border-[var(--app-accent)] text-[var(--app-accent)]'
        : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-foreground)]'"
    >
      <Icon :icon="tab.icon" class="size-3.5" />
      <span>{{ tab.label }}</span>
      <span v-if="tab.count !== undefined && tab.count > 0" class="text-xs text-[var(--app-muted)]">
        {{ tab.count }}
      </span>
    </RouterLink>
  </nav>
</template>
