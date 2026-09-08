<script setup lang="ts">
import SectionPage from '@core/pages/SectionPage.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import billing from './index'

const route = useRoute()
const current = computed(
  () =>
    billing.links.find((link) => route.path === link.path || route.path.startsWith(`${link.path}/`)) ??
    billing.links[0],
)
</script>

<template>
  <SectionPage :title="`Billing · ${current.label}`" :api-base="billing.apiBase" :space-title="billing.title" :space-description="billing.description" />
</template>
