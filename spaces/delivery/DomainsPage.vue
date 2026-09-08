<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { listDomains, type SendingDomain } from './api'

const domains = ref<SendingDomain[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    domains.value = (await listDomains()).domains ?? []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load domains'
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return domains.value
  return domains.value.filter((d) => d.domain.toLowerCase().includes(q))
})

function statusPill(d: SendingDomain): string {
  if (d.status === 'verified') return 'bg-emerald-500/15 text-emerald-600'
  return 'bg-amber-500/15 text-amber-600'
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Sending domains</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Every registered sending domain with its DKIM/SPF/DMARC status.
      </p>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search by domain…"
        class="w-full bg-transparent text-sm outline-none placeholder:text-[var(--app-muted)]"
      />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !domains.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="filtered.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <RouterLink
        v-for="domain in filtered"
        :key="domain.id"
        :to="`/delivery/domains/${domain.id}`"
        class="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--app-card-hover)]"
      >
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:globe-2" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate font-mono">{{ domain.domain }}</div>
          <div class="flex items-center gap-3 text-xs text-[var(--app-muted)] mt-0.5">
            <span :class="domain.dkim_verified ? 'text-emerald-600' : ''">
              <Icon :icon="domain.dkim_verified ? 'lucide:check' : 'lucide:x'" class="size-3 inline" /> DKIM
            </span>
            <span :class="domain.spf_verified ? 'text-emerald-600' : ''">
              <Icon :icon="domain.spf_verified ? 'lucide:check' : 'lucide:x'" class="size-3 inline" /> SPF
            </span>
            <span :class="domain.dmarc_verified ? 'text-emerald-600' : ''">
              <Icon :icon="domain.dmarc_verified ? 'lucide:check' : 'lucide:x'" class="size-3 inline" /> DMARC
            </span>
          </div>
        </div>
        <span class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0" :class="statusPill(domain)">
          {{ domain.status }}
        </span>
      </RouterLink>
    </div>

    <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:globe-2" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No domains match your search</div>
    </div>
  </section>
</template>
