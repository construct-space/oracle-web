<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DevicesPage from './DevicesPage.vue'
import ErrorsPage from './ErrorsPage.vue'
import GeoPage from './GeoPage.vue'
import ModelUsagePage from './ModelUsagePage.vue'
import OverviewPage from './OverviewPage.vue'
import PerfPage from './PerfPage.vue'
import SpaceUsagePage from './SpaceUsagePage.vue'
import ToolsPage from './ToolsPage.vue'
import UsagePage from './UsagePage.vue'

const route = useRoute()
const view = computed(() => {
  switch (route.path) {
    case '/telemetry/usage':
      return UsagePage
    case '/telemetry/devices':
      return DevicesPage
    case '/telemetry/space-usage':
      return SpaceUsagePage
    case '/telemetry/model-usage':
      return ModelUsagePage
    case '/telemetry/perf':
      return PerfPage
    case '/telemetry/errors':
      return ErrorsPage
    case '/telemetry/tools':
      return ToolsPage
    case '/telemetry/geo':
      return GeoPage
    default:
      return OverviewPage
  }
})
</script>

<template>
  <component :is="view" :key="route.fullPath" />
</template>
