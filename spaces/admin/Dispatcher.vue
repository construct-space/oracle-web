<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AdministratorsPage from './AdministratorsPage.vue'
import AuditLogPage from './AuditLogPage.vue'

const route = useRoute()
const view = computed(() => {
  if (route.path === '/admin/audit-log') return AuditLogPage
  return AdministratorsPage
})
</script>

<template>
  <component :is="view" :key="route.fullPath" />
</template>
