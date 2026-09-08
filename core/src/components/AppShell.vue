<script setup lang="ts">
import { Icon, Toolbar3D, Tooltip } from '@construct-space/ui-web'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { findSpace, oracleSpaces } from '../spaces'
import { useAuthStore } from '../stores/auth'
import ConstructLogo from './ConstructLogo.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const currentSpace = computed(() => {
  const seg = route.path.split('/').filter(Boolean)[0]
  return seg ? (findSpace(seg) ?? null) : null
})

const initials = computed(() => {
  const name = auth.user?.name || auth.user?.email || 'Oracle'
  return (
    name
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || 'O'
  )
})

async function signOut() {
  await auth.logout()
  router.replace({ name: 'login' })
}

interface Crumb {
  label: string
  to?: string
  icon?: string
}

function crumbsForPath(path: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'HOME', to: '/', icon: 'lucide:home' }]
  const segs = path.split('/').filter(Boolean)
  const space = segs[0] ? findSpace(segs[0]) : undefined
  if (space) {
    crumbs.push({ label: space.title.toUpperCase(), to: space.home })
    for (const section of space.sections) {
      const item = section.items.find((i: { path: string }) => path === i.path || path.startsWith(`${i.path}/`))
      if (item) {
        crumbs.push({ label: item.label.toUpperCase() })
        break
      }
    }
  }
  return crumbs
}

function sameCrumbs(a: Crumb[], b: Crumb[]): boolean {
  return a.length === b.length && a.every((c, i) => c.label === b[i]?.label)
}

// Must match CSS transition duration on .toolbar-cube__wrapper--animated
// in ui-web/components/Toolbar3D.vue.
const ROTATE_MS = 420

const breadcrumbs = ref<Crumb[]>(crumbsForPath(route.path))
const nextBreadcrumbs = ref<Crumb[]>([])
const rotating = ref(false)
let rotateTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => route.path,
  (path) => {
    const next = crumbsForPath(path)
    if (sameCrumbs(next, breadcrumbs.value) || rotating.value) return
    nextBreadcrumbs.value = next
    rotating.value = true
    if (rotateTimer) clearTimeout(rotateTimer)
    rotateTimer = setTimeout(() => {
      rotating.value = false
      requestAnimationFrame(() => {
        breadcrumbs.value = next
        nextBreadcrumbs.value = []
      })
    }, ROTATE_MS)
  },
)

function onCrumbClick(c: { to?: string }) {
  if (c.to) router.push(c.to)
}
</script>

<template>
  <div class="flex min-h-screen bg-[var(--app-canvas-bg)] text-[var(--app-foreground)]">
    <!-- Icon rail -->
    <aside class="w-[60px] shrink-0 bg-[var(--app-background)] border-r border-[var(--app-border)] flex flex-col items-center py-4 gap-1">
      <RouterLink
        to="/"
        class="mb-4 size-9 rounded-lg grid place-items-center text-[var(--app-accent)]"
        :class="{ 'bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]': route.name === 'home' || route.path === '/' }"
        title="Oracle home"
      >
        <ConstructLogo :size="22" />
      </RouterLink>

      <Tooltip
        v-for="space in oracleSpaces"
        :key="space.id"
        :text="space.title"
        :content="{ side: 'right', sideOffset: 8 }"
      >
        <RouterLink
          :to="space.home"
          class="size-9 rounded-lg grid place-items-center text-[var(--app-muted)] hover:text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)] transition-colors"
          :class="{ 'text-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]': currentSpace?.id === space.id }"
        >
          <Icon :icon="`lucide:${space.icon}`" class="size-5" />
        </RouterLink>
      </Tooltip>

      <div class="flex-1" />

      <button
        class="size-9 rounded-full grid place-items-center bg-[var(--app-surface)] border border-[var(--app-border)] text-xs font-semibold text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)]"
        :title="auth.user?.email ? `Sign out (${auth.user.email})` : 'Sign out'"
        @click="signOut"
      >
        {{ initials }}
      </button>
    </aside>

    <!-- Sub-nav panel (only when inside a space with sections) -->
    <aside
      v-if="currentSpace && currentSpace.sections.length"
      class="w-[260px] shrink-0 bg-[var(--app-background)] border-r border-[var(--app-border)] py-6 px-4 flex flex-col gap-6 overflow-y-auto"
    >
      <div>
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">CONSTRUCT:ORACLE</div>
        <div class="mono text-sm font-semibold mt-1">{{ currentSpace.title.toUpperCase() }}</div>
      </div>

      <div v-for="section in currentSpace.sections" :key="section.label" class="flex flex-col gap-1">
        <div class="mono text-[11px] text-[var(--app-muted)] px-2 mb-1 tracking-wider">{{ section.label }}</div>
        <RouterLink
          v-for="item in section.items"
          :key="item.path"
          :to="item.path"
          class="group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-[var(--app-muted)] hover:text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)] transition-colors"
          :class="{
            '!text-[var(--app-accent)] !bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)]': route.path === item.path || route.path.startsWith(`${item.path}/`),
          }"
        >
          <Icon :icon="`lucide:${item.icon}`" class="size-4 opacity-80" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>
    </aside>

    <!-- Main area: Toolbar3D + content -->
    <main class="flex-1 min-w-0 flex flex-col">
      <Toolbar3D
        :breadcrumbs="breadcrumbs"
        :next-breadcrumbs="nextBreadcrumbs"
        :rotating="rotating"
        :space-icon="currentSpace ? `lucide:${currentSpace.icon}` : 'lucide:hexagon'"
        @breadcrumb-click="onCrumbClick"
      />

      <div class="flex-1 overflow-y-auto px-8 py-6">
        <slot />
      </div>
    </main>
  </div>
</template>
