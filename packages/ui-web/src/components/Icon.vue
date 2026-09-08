<script setup lang="ts">
// Icon — lucide-vue-next backed wrapper.
//
// Accepts either `icon="lucide:check"` (drop-in for @iconify/vue's API)
// or `name="i-lucide-check"` / `name="lucide:check"`. Strips the
// namespace, converts kebab-case to PascalCase, and looks up the
// component in lucide-vue-next. Unknown names render nothing — this is
// what lets oracle keep `connect-src 'self'` while also gracefully
// hiding brand icons (`xai`, `openai`, etc.) that aren't in lucide.
//
// For brand logos, drop SVGs in core/public/icons/ and use a plain
// `<img>` instead of this component.
import { computed, type Component } from 'vue'
import * as Lucide from 'lucide-vue-next'

const props = defineProps<{
  icon?: string
  name?: string
  size?: number | string
  strokeWidth?: number | string
}>()

function toPascal(kebab: string): string {
  return kebab
    .split('-')
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

const resolved = computed<Component | null>(() => {
  const raw = (props.icon || props.name || '').trim()
  if (!raw || raw.length > 80 || raw.includes(' ')) return null

  let key = raw
  if (key.startsWith('i-lucide-')) key = key.slice('i-lucide-'.length)
  else if (key.startsWith('lucide:')) key = key.slice('lucide:'.length)
  else if (key.includes(':')) return null // non-lucide namespace, not supported
  // else: bare kebab name like "mail-open" — treat as lucide

  const pascal = toPascal(key)
  const found = (Lucide as unknown as Record<string, Component>)[pascal]
  return found ?? null
})
</script>

<template>
  <component :is="resolved" v-if="resolved" :size="size" :stroke-width="strokeWidth" />
</template>
