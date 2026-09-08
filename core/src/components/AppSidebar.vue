<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { findSpace, oracleSpaces } from '../spaces'
import { useAuthStore } from '../stores/auth'
import { Icon, Tooltip } from '@construct-space/ui-web'
import ConstructLogo from './ConstructLogo.vue'

const route = useRoute()
const router = useRouter()
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
</script>

<template>
  <aside class="flex min-w-[395px] flex-[0_0_395px] border-r border-[#e4e7ee] bg-[#f7f8fb]">
    <div class="flex w-[76px] flex-col items-center gap-3 border-r border-[#e7e9f0] bg-[#fcfcfe] px-[14px] py-5">
      <RouterLink to="/" class="grid h-10 w-10 place-items-center rounded-xl text-[var(--app-accent)]" title="Oracle home">
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
          class="grid h-10 w-10 place-items-center rounded-xl text-slate-900 transition-colors hover:bg-[#f1e1e4]"
          :class="{ 'bg-[#f1e1e4] text-slate-900': currentSpace?.id === space.id }"
        >
          <Icon :name="space.icon" :size="19" />
        </RouterLink>
      </Tooltip>

      <div class="flex-1" />

      <button
        class="grid h-10 w-10 place-items-center rounded-full border border-[#eadce0] bg-[#f8edf0] font-bold text-slate-500"
        :title="auth.user?.email || 'Sign out'"
        @click="signOut"
      >
        {{ initials }}
      </button>
    </div>

    <div v-if="currentSpace" class="flex flex-1 flex-col gap-[22px] overflow-y-auto px-[18px] pb-6 pt-5">
      <div class="grid gap-1">
        <div class="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Construct:Account</div>
        <div class="text-[15px] font-extrabold tracking-[0.02em] text-slate-900">{{ currentSpace.title.toUpperCase() }}</div>
      </div>

      <div v-for="section in currentSpace.sections" :key="section.label" class="grid gap-1.5">
        <div class="px-1.5 pb-2 text-xs uppercase tracking-[0.08em] text-slate-500">{{ section.label }}</div>
        <RouterLink
          v-for="item in section.items"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-slate-800 transition-colors hover:bg-[#f1e1e4] hover:text-red-500"
          :class="{ 'bg-[#f1e1e4] text-red-500': route.path === item.path || route.path.startsWith(`${item.path}/`) }"
        >
          <Icon :name="item.icon" :size="17" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>
    </div>
  </aside>
</template>
