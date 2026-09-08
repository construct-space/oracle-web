<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ConstructConfigPage from './ConstructConfigPage.vue'
import ConstructUpstreamsPage from './ConstructUpstreamsPage.vue'
import PickerEntriesPage from './PickerEntriesPage.vue'
import ProviderDetailPage from './ProviderDetailPage.vue'
import ProvidersPage from './ProvidersPage.vue'
import RoutingTargetsPage from './RoutingTargetsPage.vue'
import SourceFamilyPage from './SourceFamilyPage.vue'

const route = useRoute()
const view = computed(() => {
  const p = route.path
  if (p.startsWith('/provider/source-family')) return SourceFamilyPage
  if (p.startsWith('/provider/construct/upstreams')) return ConstructUpstreamsPage
  if (p.startsWith('/provider/construct/picker-entries')) return PickerEntriesPage
  if (p.startsWith('/provider/construct/routing-targets')) return RoutingTargetsPage
  if (p.startsWith('/provider/construct/config')) return ConstructConfigPage
  if (p.match(/^\/provider\/providers\/[^/]+$/)) return ProviderDetailPage
  return ProvidersPage
})
</script>

<template>
  <component :is="view" :key="route.fullPath" />
</template>
