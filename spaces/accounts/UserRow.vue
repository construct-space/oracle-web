<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { AccountUser } from './api'

const props = defineProps<{ user: AccountUser }>()

const fullName = computed(
  () => [props.user.first_name, props.user.last_name].filter(Boolean).join(' ') || props.user.username,
)

const initials = computed(() => {
  const base = (fullName.value || props.user.email || '?').trim()
  const parts = base.split(/\s+|@/).filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
})

const lastLogin = computed(() => {
  const iso = props.user.last_login
  if (!iso) return 'Never'
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(iso)
  }
})

const status = computed(() => {
  if (props.user.suspended) return { label: 'Suspended', badge: 'bg-rose-500/15 text-rose-500' }
  if (props.user.totp_enabled) return { label: '2FA enabled', badge: 'bg-sky-500/15 text-sky-500' }
  return { label: 'Active', badge: 'bg-emerald-500/15 text-emerald-600' }
})
</script>

<template>
  <RouterLink
    :to="`/accounts/users/${user.id}`"
    class="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--app-card-hover)]"
    :aria-label="`Open ${fullName}`"
  >
    <div class="size-9 rounded-full grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] text-sm font-semibold overflow-hidden shrink-0">
      <span>{{ initials }}</span>
    </div>

    <div class="flex-1 min-w-0">
      <div class="text-sm font-medium truncate">{{ fullName }}</div>
      <div class="text-xs text-[var(--app-muted)] truncate">{{ user.email }}</div>
    </div>

    <div class="w-36 shrink-0 hidden md:block">
      <span class="inline-flex text-xs font-medium px-2.5 py-1 rounded" :class="status.badge">
        {{ status.label }}
      </span>
    </div>

    <span class="text-xs text-[var(--app-muted)] w-28 shrink-0 hidden md:inline">{{ lastLogin }}</span>

    <span class="size-8 rounded-md grid place-items-center text-[var(--app-muted)]">
      <Icon icon="lucide:chevron-right" class="size-4" />
    </span>
  </RouterLink>
</template>
