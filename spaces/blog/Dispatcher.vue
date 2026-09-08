<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PostEditPage from './PostEditPage.vue'
import PostsPage from './PostsPage.vue'

const route = useRoute()

const view = computed(() => {
  if (route.path.startsWith('/blog/posts/')) return PostEditPage
  return PostsPage
})
</script>

<template>
  <component :is="view" :key="route.fullPath" />
</template>
