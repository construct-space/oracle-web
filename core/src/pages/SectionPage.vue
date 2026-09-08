<script setup lang="ts">
import { Badge, Button, Card } from '@construct-space/ui-web'

defineProps<{
  title: string
  apiBase: string
  spaceTitle?: string
  spaceDescription?: string
}>()
</script>

<template>
  <div class="grid gap-5">
    <header>
      <p class="text-xs font-bold uppercase tracking-[0.08em] text-[var(--app-muted)]">Scaffold</p>
      <h1 class="mt-1 text-5xl font-black tracking-tight text-[var(--app-foreground)]">{{ title }}</h1>
      <p class="mt-3 max-w-3xl text-base leading-7 text-[var(--app-muted)]">
        This page is intentionally fresh. Add real Oracle-backed data flows here instead of porting legacy UI blindly.
      </p>
      <p v-if="spaceTitle" class="mt-3 text-sm text-[var(--app-muted)]">
        Space: <strong class="text-[var(--app-foreground)]">{{ spaceTitle }}</strong><span v-if="spaceDescription"> — {{ spaceDescription }}</span>
      </p>
    </header>

    <Card>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-[var(--app-foreground)]">Suggested API surface</h2>
          <p class="mt-3 max-w-3xl text-base leading-7 text-[var(--app-muted)]">
            Prefer Oracle-owned admin routes as the frontend contract, then let Oracle proxy/orchestrate internal service calls behind the scenes.
          </p>
          <div class="mt-4"><Badge variant="soft">{{ apiBase }}</Badge></div>
        </div>
        <Button variant="outline" color="neutral" label="Scaffolded" disabled />
      </div>
    </Card>
  </div>
</template>
