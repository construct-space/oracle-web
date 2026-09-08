<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import FeedPage from './FeedPage.vue'
import OrganizationsPage from './OrganizationsPage.vue'
import OrgInvitesPage from './OrgInvitesPage.vue'
import OrgMembersPage from './OrgMembersPage.vue'
import OrgOverviewPage from './OrgOverviewPage.vue'
import OrgProjectsPage from './OrgProjectsPage.vue'
import OrgTeamsPage from './OrgTeamsPage.vue'

const route = useRoute()
const view = computed(() => {
  const p = route.path
  if (p.endsWith('/members')) return OrgMembersPage
  if (p.endsWith('/projects')) return OrgProjectsPage
  if (p.endsWith('/teams')) return OrgTeamsPage
  if (p.endsWith('/invites')) return OrgInvitesPage
  if (p.match(/^\/source\/organizations\/[^/]+$/)) return OrgOverviewPage
  if (p.startsWith('/source/feed')) return FeedPage
  return OrganizationsPage
})
</script>

<template>
  <component :is="view" :key="route.fullPath" />
</template>
