<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { type AdminDomainDetail, getDomain } from './api'

const route = useRoute()
const detail = ref<AdminDomainDetail | null>(null)
const loading = ref(false)
const error = ref('')

const domainName = computed(() => {
  const p = route.path.replace(/^\/domains\/list\//, '')
  return decodeURIComponent(p)
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    detail.value = await getDomain(domainName.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load domain'
  } finally {
    loading.value = false
  }
}

watch(domainName, load)

function fmtDate(s?: string | null): string {
  if (!s) return '—'
  const t = new Date(s)
  if (isNaN(t.getTime())) return s
  return t.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* ignored */
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <RouterLink to="/domains/list" class="text-xs text-[var(--app-muted)] hover:text-[var(--app-foreground)] inline-flex items-center gap-1.5 w-fit">
      <Icon icon="lucide:arrow-left" class="size-3.5" />
      All domains
    </RouterLink>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !detail" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <template v-else-if="detail">
      <div class="flex items-center gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-5 py-4">
        <div class="size-12 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:globe-2" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <h1 class="text-xl font-semibold truncate font-mono">{{ detail.domain.domain }}</h1>
          <div class="text-xs text-[var(--app-muted)] mt-1 flex items-center gap-2">
            <span>Expires {{ detail.domain.expire_date || '—' }}</span>
            <span>·</span>
            <code
              class="cursor-pointer hover:text-[var(--app-foreground)]"
              :title="detail.domain.user_uuid + ' (click to copy)'"
              @click="copy(detail.domain.user_uuid)"
            >user {{ detail.domain.user_uuid.slice(0, 8) }}…</code>
          </div>
        </div>
        <span
          class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0"
          :class="detail.domain.status === 'active' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'"
        >{{ detail.domain.status }}</span>
      </div>

      <!-- Domain facts -->
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">AUTO-RENEW</div>
          <div class="text-sm">{{ detail.domain.auto_renew ? 'On' : 'Off' }}</div>
        </div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">WHOIS PRIVACY</div>
          <div class="text-sm">{{ detail.domain.whois_privacy ? 'Enabled' : 'Disabled' }}</div>
        </div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-1">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">SECURITY LOCK</div>
          <div class="text-sm">{{ detail.domain.security_lock ? 'Locked' : 'Unlocked' }}</div>
        </div>
      </div>

      <!-- Redirect -->
      <div v-if="detail.redirect" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-2">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">REDIRECT</div>
        <div class="flex items-center gap-2 text-sm">
          <code>{{ detail.redirect.source_domain }}</code>
          <Icon icon="lucide:arrow-right" class="size-4 text-[var(--app-muted)]" />
          <code>{{ detail.redirect.target_domain }}</code>
          <span class="inline-flex text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)]">
            {{ detail.redirect.redirect_type }}
          </span>
          <span v-if="detail.redirect.include_path" class="text-[10px] uppercase tracking-wider text-[var(--app-muted)]">+ path</span>
        </div>
      </div>

      <!-- DNS -->
      <div class="flex flex-col gap-2">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">DNS RECORDS ({{ detail.dns.length }})</div>
        <div
          v-if="detail.dns.length"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
        >
          <div v-for="rec in detail.dns" :key="rec.id" class="px-5 py-3 flex items-center gap-3">
            <span class="inline-flex text-xs font-medium px-2 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)] font-mono shrink-0 w-14 justify-center">{{ rec.type }}</span>
            <span class="text-sm font-mono truncate w-40 shrink-0">{{ rec.name }}</span>
            <code class="flex-1 text-xs font-mono truncate">{{ rec.content }}</code>
            <span v-if="rec.ttl" class="text-xs text-[var(--app-muted)] shrink-0">TTL {{ rec.ttl }}</span>
          </div>
        </div>
        <div v-else class="text-sm text-[var(--app-muted)] px-5 py-3 rounded-xl border border-dashed border-[var(--app-border)]">
          No DNS records cached for this domain.
        </div>
      </div>
    </template>
  </section>
</template>
