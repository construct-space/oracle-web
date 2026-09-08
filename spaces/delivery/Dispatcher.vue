<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import APIKeysPage from './APIKeysPage.vue'
import DomainDetailPage from './DomainDetailPage.vue'
import DomainsPage from './DomainsPage.vue'
import MessagesPage from './MessagesPage.vue'
import NotificationsPage from './NotificationsPage.vue'
import OverviewPage from './OverviewPage.vue'
import TenantsPage from './TenantsPage.vue'

const route = useRoute()
const view = computed(() => {
  const p = route.path
  if (p.startsWith('/delivery/domains/')) return DomainDetailPage
  if (p === '/delivery/domains') return DomainsPage
  if (p === '/delivery/messages') return MessagesPage
  if (p === '/delivery/tenants') return TenantsPage
  if (p === '/delivery/api-keys') return APIKeysPage
  if (p === '/delivery/notifications') return NotificationsPage
  return OverviewPage
})
</script>

<template>
  <component :is="view" :key="route.fullPath" />
</template>
