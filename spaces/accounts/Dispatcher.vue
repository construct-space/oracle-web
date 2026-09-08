<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import OAuthClientDetailPage from './OAuthClientDetailPage.vue'
import OAuthClientsPage from './OAuthClientsPage.vue'
import SessionsPage from './SessionsPage.vue'
import UserDetailPage from './UserDetailPage.vue'
import UsersPage from './UsersPage.vue'

const route = useRoute()
const view = computed(() => {
  if (route.path.startsWith('/accounts/users/')) return UserDetailPage
  if (route.path.startsWith('/accounts/oauth-clients/')) return OAuthClientDetailPage
  if (route.path === '/accounts/sessions') return SessionsPage
  if (route.path === '/accounts/oauth-clients') return OAuthClientsPage
  return UsersPage
})
</script>

<template>
  <component :is="view" :key="route.fullPath" />
</template>
