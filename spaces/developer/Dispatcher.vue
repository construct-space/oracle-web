<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AllSpacesPage from './AllSpacesPage.vue'
import GraphPage from './GraphPage.vue'
import PendingSpacesPage from './PendingSpacesPage.vue'
import PublisherDetailPage from './PublisherDetailPage.vue'
import PublishersPage from './PublishersPage.vue'
import SchemaDetailPage from './SchemaDetailPage.vue'
import SpaceDetailPage from './SpaceDetailPage.vue'

const route = useRoute()
const view = computed(() => {
  if (route.path.startsWith('/developer/publishers/')) return PublisherDetailPage
  if (route.path.startsWith('/developer/spaces/')) return SpaceDetailPage
  if (route.path === '/developer/publishers') return PublishersPage
  if (route.path === '/developer/pending-spaces') return PendingSpacesPage
  if (route.path === '/developer/spaces') return AllSpacesPage
  if (route.path.startsWith('/developer/graph/')) return SchemaDetailPage
  if (route.path === '/developer/graph') return GraphPage
  return PublishersPage
})
</script>

<template>
  <component :is="view" :key="route.fullPath" />
</template>
