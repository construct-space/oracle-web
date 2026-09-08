<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DomainDetailPage from './DomainDetailPage.vue'
import DomainsPage from './DomainsPage.vue'
import OverviewPage from './OverviewPage.vue'
import RedirectsPage from './RedirectsPage.vue'
import TenantsPage from './TenantsPage.vue'

const route = useRoute()

// domains/list/<name> is the per-domain detail path. Matching by startsWith
// keeps the detail page owning both /domains/list/<name> and deeper slugs
// (e.g. /domains/list/<name>/dns) without extra route registration.
const view = computed(() => {
  const p = route.path
  if (p.startsWith('/domains/list/')) return DomainDetailPage
  if (p === '/domains/list') return DomainsPage
  if (p === '/domains/redirects') return RedirectsPage
  if (p === '/domains/tenants') return TenantsPage
  return OverviewPage
})
</script>

<template>
  <component :is="view" :key="route.fullPath" />
</template>
