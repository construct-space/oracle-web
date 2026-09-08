<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import CategoriesPage from './CategoriesPage.vue'
import CollectionEditPage from './CollectionEditPage.vue'
import CollectionsPage from './CollectionsPage.vue'
import SpacesPage from './SpacesPage.vue'

const route = useRoute()

const view = computed(() => {
  if (route.path.startsWith('/marketplace/collections/')) return CollectionEditPage
  if (route.path === '/marketplace/collections') return CollectionsPage
  if (route.path === '/marketplace/categories') return CategoriesPage
  if (route.path === '/marketplace/spaces') return SpacesPage
  return SpacesPage
})
</script>

<template>
  <component :is="view" :key="route.fullPath" />
</template>
