<script setup lang="ts">
import { Icon } from '@construct-space/ui-web'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  createProviderModel,
  deleteProvider,
  deleteProviderModel,
  getProvider,
  type ProviderDetail,
  type ProviderModel,
  type RequestSpec,
  syncProviderModel,
  unlockProviderModel,
  updateProvider,
  updateProviderModel,
} from './api'

const route = useRoute()
const router = useRouter()
const providerId = computed(() => String(route.params.id))

const detail = ref<ProviderDetail | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const form = ref({
  name: '',
  slug: '',
  description: '',
  icon: '',
  capabilities: '',
  enabled: true,
  min_app_version: '',
  sort_order: 0,

  api_key: {
    enabled: false,
    base_url: '',
    env_keys: '',
    docs_url: '',
    signup_url: '',
    has_shared_key: false,
  },
  monthly: {
    enabled: false,
    auth_type: 'oauth_pkce',
    base_url: '',
    oauth_config: '',
    docs_url: '',
    signup_url: '',
  },
})

const activeTab = ref<'api_key' | 'monthly'>('api_key')
const saving = ref(false)
const saveError = ref<string | null>(null)
const removing = ref(false)

// Add-model form is minimal now — just the wire id (what the API calls
// the model, e.g. "claude-opus-4-7"). Everything else — display name,
// context window, pricing, capabilities, request spec — is filled by
// the models.dev sync that auto-runs after create. If models.dev
// doesn't know the model, the row is created with placeholder values
// and the admin edits it manually.
const newModel = ref({ model_id: '' })
const creatingModel = ref(false)
const modelError = ref<string | null>(null)
const addNotice = ref<string | null>(null)
const pending = ref<Record<string, boolean>>({})

function hydrate(d: ProviderDetail) {
  const p = d.provider
  form.value = {
    name: p.name,
    slug: p.slug,
    description: p.description,
    icon: p.icon,
    capabilities: (p.capabilities || []).join(', '),
    enabled: p.enabled,
    min_app_version: p.min_app_version,
    sort_order: p.sort_order,

    api_key: {
      enabled: p.api_key?.enabled ?? false,
      base_url: p.api_key?.base_url ?? '',
      env_keys: (p.api_key?.env_keys || []).join(', '),
      docs_url: p.api_key?.docs_url ?? '',
      signup_url: p.api_key?.signup_url ?? '',
      has_shared_key: p.api_key?.has_shared_key ?? false,
    },
    monthly: {
      enabled: p.monthly?.enabled ?? false,
      auth_type: p.monthly?.auth_type || 'oauth_pkce',
      base_url: p.monthly?.base_url ?? '',
      oauth_config: p.monthly?.oauth_config ? JSON.stringify(p.monthly.oauth_config, null, 2) : '',
      docs_url: p.monthly?.docs_url ?? '',
      signup_url: p.monthly?.signup_url ?? '',
    },
  }
  // Pick the first enabled mode as the default tab so the admin lands on
  // relevant settings; fall back to api_key when nothing is enabled.
  activeTab.value = form.value.api_key.enabled ? 'api_key' : form.value.monthly.enabled ? 'monthly' : 'api_key'
}

async function load() {
  loading.value = true
  error.value = null
  try {
    detail.value = await getProvider(providerId.value)
    hydrate(detail.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function parseList(raw: string): string[] | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseOAuthConfig(raw: string): Record<string, unknown> | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return undefined
  }
}

async function save() {
  saving.value = true
  saveError.value = null
  try {
    const oauthCfg = parseOAuthConfig(form.value.monthly.oauth_config)
    if (form.value.monthly.oauth_config.trim() && !oauthCfg) {
      saveError.value = 'OAuth config: invalid JSON'
      return
    }
    await updateProvider(providerId.value, {
      name: form.value.name,
      slug: form.value.slug,
      description: form.value.description,
      icon: form.value.icon,
      capabilities: parseList(form.value.capabilities),
      enabled: form.value.enabled,
      min_app_version: form.value.min_app_version,
      sort_order: form.value.sort_order,
      api_key: {
        enabled: form.value.api_key.enabled,
        base_url: form.value.api_key.base_url,
        env_keys: parseList(form.value.api_key.env_keys),
        docs_url: form.value.api_key.docs_url,
        signup_url: form.value.api_key.signup_url,
        has_shared_key: form.value.api_key.has_shared_key,
      },
      monthly: {
        enabled: form.value.monthly.enabled,
        auth_type: form.value.monthly.auth_type,
        base_url: form.value.monthly.base_url,
        oauth_config: oauthCfg,
        docs_url: form.value.monthly.docs_url,
        signup_url: form.value.monthly.signup_url,
      },
    })
    await load()
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!confirm(`Delete provider "${form.value.name}"? This also drops every model under it.`)) return
  removing.value = true
  try {
    await deleteProvider(providerId.value)
    await router.push('/provider/providers')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    removing.value = false
  }
}

async function addModel() {
  let modelId = newModel.value.model_id.trim()
  if (!modelId) return

  // Strip a leading "providerID/" if the admin pasted something like
  // "xai/grok-3" from a docs page or error message — the model id is
  // the part after the slash, the provider is already in the URL.
  const prefix = `${providerId.value}/`
  if (modelId.startsWith(prefix)) modelId = modelId.slice(prefix.length)

  // Slashes and colons break URL routing (model id becomes the {modelId}
  // path segment) and our composite row-id scheme ("provider:model").
  // Bail with a clear error rather than creating an unreachable row.
  if (modelId.includes('/') || modelId.includes(':')) {
    modelError.value = `Model id can't contain "/" or ":" — got "${modelId}".`
    return
  }

  // Row id follows the "providerID:modelID" convention the rest of the
  // catalog uses (see seed_providers.go). Deriving it here instead of
  // asking the admin removes one more thing to fat-finger.
  const rowID = `${providerId.value}:${modelId}`

  creatingModel.value = true
  modelError.value = null
  addNotice.value = null
  try {
    // Create with placeholder name — sync will replace it from
    // models.dev. If sync fails (unknown upstream), the row still
    // exists and the admin can fill fields via the Edit drawer.
    await createProviderModel(providerId.value, {
      id: rowID,
      model_id: modelId,
      name: modelId,
    })
    try {
      await syncProviderModel(providerId.value, rowID)
      addNotice.value = `Added ${modelId} — fields filled from models.dev.`
    } catch (syncErr) {
      // Server puts the list of available model IDs right in the
      // error string when the provided id didn't match upstream — pass
      // it through so the admin can fix the typo without leaving.
      const msg = syncErr instanceof Error ? syncErr.message : String(syncErr)
      addNotice.value = `Added ${modelId}, but ${msg}. Use Edit to fill fields manually, or Delete + re-add with the correct id.`
      console.warn('models.dev sync after add failed:', syncErr)
    }
    newModel.value = { model_id: '' }
    await load()
  } catch (e) {
    modelError.value = e instanceof Error ? e.message : String(e)
  } finally {
    creatingModel.value = false
  }
}

async function toggleModelEnabled(m: ProviderModel) {
  pending.value[m.id] = true
  try {
    await updateProviderModel(providerId.value, m.id, { enabled: !m.enabled })
    await load()
  } catch (e) {
    modelError.value = e instanceof Error ? e.message : String(e)
  } finally {
    pending.value[m.id] = false
  }
}

async function toggleModelMode(m: ProviderModel, mode: 'api_key' | 'monthly') {
  pending.value[m.id] = true
  try {
    const patch =
      mode === 'api_key'
        ? { available_on_api_key: !m.available_on_api_key }
        : { available_on_monthly: !m.available_on_monthly }
    await updateProviderModel(providerId.value, m.id, patch)
    await load()
  } catch (e) {
    modelError.value = e instanceof Error ? e.message : String(e)
  } finally {
    pending.value[m.id] = false
  }
}

async function toggleModelDeprecated(m: ProviderModel) {
  pending.value[m.id] = true
  try {
    await updateProviderModel(providerId.value, m.id, { deprecated: !m.deprecated })
    await load()
  } catch (e) {
    modelError.value = e instanceof Error ? e.message : String(e)
  } finally {
    pending.value[m.id] = false
  }
}

async function removeModel(m: ProviderModel) {
  if (!confirm(`Delete model "${m.name}"?`)) return
  pending.value[m.id] = true
  try {
    await deleteProviderModel(providerId.value, m.id)
    await load()
  } catch (e) {
    modelError.value = e instanceof Error ? e.message : String(e)
  } finally {
    pending.value[m.id] = false
  }
}

// Sync this single row from models.dev. Server refuses if locked — in
// that case we show a clear message rather than a generic 500.
async function syncModel(m: ProviderModel) {
  pending.value[m.id] = true
  modelError.value = null
  try {
    await syncProviderModel(providerId.value, m.id)
    await load()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('locked')) {
      modelError.value = `${m.name} is locked — unlock first to overwrite with models.dev data.`
    } else {
      // Server's 404 already contains the list of upstream IDs for
      // this provider; surfacing it verbatim lets the admin rename
      // the row (via Edit → model_id) to whatever models.dev uses.
      modelError.value = `${m.name}: ${msg}`
    }
  } finally {
    pending.value[m.id] = false
  }
}

async function unlockModel(m: ProviderModel) {
  if (!confirm(`Unlock "${m.name}"? The next sync will overwrite any manual edits.`)) return
  pending.value[m.id] = true
  try {
    await unlockProviderModel(providerId.value, m.id)
    await load()
  } catch (e) {
    modelError.value = e instanceof Error ? e.message : String(e)
  } finally {
    pending.value[m.id] = false
  }
}

// ─── Request spec editor ──────────────────────────────────────────────────
//
// Per-model request-shape flags. Operator reads these at dispatch time
// to decide whether to emit temperature/top_p/top_k/thinking. Empty
// spec ≡ operator's restrictive default (no legacy params, adaptive
// thinking), which is what Claude Opus 4.7+ wants.

const SPEC_PRESETS: Record<string, { label: string; spec: RequestSpec }> = {
  restrictive: {
    label: 'Restrictive (4.7+ / unknown new models)',
    spec: { thinking: 'adaptive' },
  },
  legacy4x: {
    label: 'Legacy 4.x (Claude 4.6 / 4.5)',
    spec: {
      accepts_temperature: true,
      accepts_top_p: true,
      accepts_top_k: true,
      accepts_prefill: true,
      thinking: 'fixed',
    },
  },
  permissive: {
    label: 'Permissive (older OpenAI / DeepSeek / etc.)',
    spec: {
      accepts_temperature: true,
      accepts_top_p: true,
      thinking: 'none',
    },
  },
}

const editingSpecId = ref<string | null>(null)
const specDraft = ref('')
const specError = ref<string | null>(null)
const specSaving = ref(false)

// Settings drawer fields — edit on top of request_spec JSON. Numeric
// values are kept as-is (no empty-string tri-state) since 0 is a valid
// value for a free model.
const settingsDraft = ref({
  context_window: 0,
  max_output_tokens: 0,
  input_cost_per_1m: 0,
  output_cost_per_1m: 0,
  cache_read_cost_per_1m: 0,
  cache_write_cost_per_1m: 0,
  tier_hint: '' as '' | 'large' | 'medium' | 'small',
})

function specBadge(m: ProviderModel): { label: string; tone: 'green' | 'amber' | 'blue' | 'muted' } {
  const s = m.request_spec
  if (!s) return { label: 'default', tone: 'muted' }
  // Heuristic — match the named presets so admins see a familiar label
  // at a glance. "custom" means the spec doesn't match any preset.
  const keys = Object.keys(s) as Array<keyof RequestSpec>
  const has = (k: keyof RequestSpec) => Boolean(s[k])
  if (keys.length === 1 && s.thinking === 'adaptive') return { label: 'restrictive', tone: 'blue' }
  if (
    has('accepts_temperature') &&
    has('accepts_top_p') &&
    has('accepts_top_k') &&
    has('accepts_prefill') &&
    s.thinking === 'fixed'
  ) {
    return { label: 'legacy 4.x', tone: 'green' }
  }
  return { label: 'custom', tone: 'amber' }
}

function toneClasses(tone: 'green' | 'amber' | 'blue' | 'muted'): string {
  switch (tone) {
    case 'green':
      return 'bg-emerald-500/15 text-emerald-500'
    case 'amber':
      return 'bg-amber-500/15 text-amber-500'
    case 'blue':
      return 'bg-sky-500/15 text-sky-500'
    default:
      return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
  }
}

function openSpecEditor(m: ProviderModel) {
  editingSpecId.value = m.id
  specError.value = null
  specDraft.value = m.request_spec ? JSON.stringify(m.request_spec, null, 2) : ''
  settingsDraft.value = {
    context_window: m.context_window || 0,
    max_output_tokens: m.max_output_tokens || 0,
    input_cost_per_1m: m.input_cost_per_1m || 0,
    output_cost_per_1m: m.output_cost_per_1m || 0,
    cache_read_cost_per_1m: m.cache_read_cost_per_1m || 0,
    cache_write_cost_per_1m: m.cache_write_cost_per_1m || 0,
    tier_hint: (m.tier_hint as '' | 'large' | 'medium' | 'small') || '',
  }
}

function closeSpecEditor() {
  editingSpecId.value = null
  specError.value = null
  specDraft.value = ''
}

function applyPreset(name: keyof typeof SPEC_PRESETS) {
  specDraft.value = JSON.stringify(SPEC_PRESETS[name].spec, null, 2)
  specError.value = null
}

async function saveSpec(m: ProviderModel) {
  specError.value = null
  let parsed: RequestSpec | null = null
  const raw = specDraft.value.trim()
  if (raw) {
    try {
      parsed = JSON.parse(raw) as RequestSpec
    } catch (e) {
      specError.value = 'Invalid JSON: ' + (e instanceof Error ? e.message : String(e))
      return
    }
    // Reject unknown top-level keys so admins notice typos like
    // "accept_temperature" instead of silently saving something the
    // operator will ignore.
    const allowed = new Set(['accepts_temperature', 'accepts_top_p', 'accepts_top_k', 'accepts_prefill', 'thinking'])
    const unknown = Object.keys(parsed).filter((k) => !allowed.has(k))
    if (unknown.length) {
      specError.value = `Unknown field(s): ${unknown.join(', ')}`
      return
    }
    if (parsed.thinking && !['none', 'fixed', 'adaptive'].includes(parsed.thinking)) {
      specError.value = `thinking must be "none", "fixed", or "adaptive"`
      return
    }
  }
  specSaving.value = true
  try {
    await updateProviderModel(providerId.value, m.id, {
      request_spec: parsed,
      context_window: settingsDraft.value.context_window,
      max_output_tokens: settingsDraft.value.max_output_tokens,
      input_cost_per_1m: settingsDraft.value.input_cost_per_1m,
      output_cost_per_1m: settingsDraft.value.output_cost_per_1m,
      cache_read_cost_per_1m: settingsDraft.value.cache_read_cost_per_1m,
      cache_write_cost_per_1m: settingsDraft.value.cache_write_cost_per_1m,
      tier_hint: settingsDraft.value.tier_hint,
    })
    await load()
    closeSpecEditor()
  } catch (e) {
    specError.value = e instanceof Error ? e.message : String(e)
  } finally {
    specSaving.value = false
  }
}

watch(providerId, load)
onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-6">
    <div class="flex items-center gap-3">
      <RouterLink
        to="/provider/providers"
        class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-[var(--app-muted)] hover:bg-[var(--app-card-hover)]"
      >
        <Icon icon="lucide:arrow-left" class="size-3.5" />
        Providers
      </RouterLink>
    </div>

    <div v-if="loading && !detail" class="text-sm text-[var(--app-muted)]">Loading…</div>
    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <template v-if="detail">
      <!-- Header -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold">{{ detail.provider.name }}</h1>
          <p class="text-sm text-[var(--app-muted)] mt-1 font-mono">{{ detail.provider.id }}</p>
          <div class="flex items-center gap-2 mt-2">
            <span v-if="detail.provider.api_key?.enabled" class="text-[10px] font-medium px-2 py-0.5 rounded bg-[var(--app-accent)]/15 text-[var(--app-accent)]">API key mode</span>
            <span v-if="detail.provider.monthly?.enabled" class="text-[10px] font-medium px-2 py-0.5 rounded bg-sky-500/15 text-sky-500">Monthly plan mode</span>
            <span v-if="!detail.provider.enabled" class="text-[10px] font-medium px-2 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)]">disabled</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-red-500/30 text-red-500 px-3 py-1.5 text-xs font-medium hover:bg-red-500/10 disabled:opacity-50"
            :disabled="removing"
            @click="remove"
          >
            {{ removing ? 'Deleting…' : 'Delete provider' }}
          </button>
        </div>
      </div>

      <!-- Common info -->
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-4">
        <h2 class="text-sm font-semibold">Provider info</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
            Name
            <input v-model="form.name" type="text" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)]" />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
            Slug
            <input v-model="form.slug" type="text" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)] font-mono" />
          </label>
          <label class="md:col-span-2 flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
            Description
            <textarea v-model="form.description" rows="2" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)] resize-y" />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
            Icon (lucide)
            <input v-model="form.icon" type="text" placeholder="cpu" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)] font-mono" />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
            Capabilities (comma)
            <input v-model="form.capabilities" type="text" placeholder="tools, vision" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)]" />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
            Min app version
            <input v-model="form.min_app_version" type="text" placeholder="0.18.0" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)] font-mono" />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
            Sort order
            <input v-model.number="form.sort_order" type="number" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)]" />
          </label>
        </div>
        <div class="border-t border-[var(--app-border)] pt-3">
          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="form.enabled" type="checkbox" class="size-4" />
            Enabled (visible to clients)
          </label>
        </div>
      </div>

      <!-- Mode tabs -->
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)]">
        <div class="flex items-center gap-1 border-b border-[var(--app-border)] px-2">
          <button
            class="px-3 py-2.5 text-xs font-medium border-b-2 transition-colors"
            :class="activeTab === 'api_key' ? 'border-[var(--app-accent)] text-[var(--app-foreground)]' : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-foreground)]'"
            @click="activeTab = 'api_key'"
          >
            API key
            <span v-if="form.api_key.enabled" class="inline-block size-1.5 rounded-full bg-emerald-500 ml-1" />
          </button>
          <button
            class="px-3 py-2.5 text-xs font-medium border-b-2 transition-colors"
            :class="activeTab === 'monthly' ? 'border-[var(--app-accent)] text-[var(--app-foreground)]' : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-foreground)]'"
            @click="activeTab = 'monthly'"
          >
            Monthly plan
            <span v-if="form.monthly.enabled" class="inline-block size-1.5 rounded-full bg-emerald-500 ml-1" />
          </button>
        </div>

        <!-- API key panel -->
        <div v-if="activeTab === 'api_key'" class="p-5 flex flex-col gap-4">
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.api_key.enabled" type="checkbox" class="size-4" />
            <span class="font-medium">API key mode enabled</span>
            <span class="text-xs text-[var(--app-muted)] ml-2">Users paste a key from the provider's console</span>
          </label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
              Base URL
              <input v-model="form.api_key.base_url" type="text" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)] font-mono" />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
              Env keys (comma)
              <input v-model="form.api_key.env_keys" type="text" placeholder="ANTHROPIC_API_KEY" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)] font-mono" />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
              Docs URL
              <input v-model="form.api_key.docs_url" type="text" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)]" />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
              Signup URL
              <input v-model="form.api_key.signup_url" type="text" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)]" />
            </label>
          </div>
          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="form.api_key.has_shared_key" type="checkbox" class="size-4" />
            <span>Org-shared key available</span>
            <span class="text-xs text-[var(--app-muted)] ml-2">When on, admins can enforce a shared key for their whole org</span>
          </label>
        </div>

        <!-- Monthly plan panel -->
        <div v-else class="p-5 flex flex-col gap-4">
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.monthly.enabled" type="checkbox" class="size-4" />
            <span class="font-medium">Monthly plan mode enabled</span>
            <span class="text-xs text-[var(--app-muted)] ml-2">Users sign in via OAuth to a subscription</span>
          </label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
              Auth flow
              <select v-model="form.monthly.auth_type" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)]">
                <option value="oauth_pkce">OAuth (PKCE)</option>
                <option value="oauth_device_code">OAuth (device code)</option>
                <option value="anthropic_oauth">Anthropic OAuth</option>
                <option value="copilot_device">GitHub Copilot device</option>
                <option value="api_key">Separate API key (e.g. MiMo token plan)</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
              Base URL
              <input v-model="form.monthly.base_url" type="text" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)] font-mono" />
            </label>
            <label class="md:col-span-2 flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
              OAuth config (JSON)
              <textarea v-model="form.monthly.oauth_config" rows="5" placeholder='{"client_id":"…","authorize_url":"…","token_url":"…","scopes":[…]}' class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-xs text-[var(--app-foreground)] font-mono resize-y" />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
              Docs URL
              <input v-model="form.monthly.docs_url" type="text" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)]" />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-[var(--app-muted)]">
              Signup URL
              <input v-model="form.monthly.signup_url" type="text" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm text-[var(--app-foreground)]" />
            </label>
          </div>
        </div>

        <div class="border-t border-[var(--app-border)] p-5 flex items-center gap-3">
          <button
            class="inline-flex items-center gap-2 rounded-lg bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            :disabled="saving"
            @click="save"
          >
            <Icon v-if="saving" icon="lucide:loader-2" class="size-3.5 animate-spin" />
            <Icon v-else icon="lucide:save" class="size-3.5" />
            Save
          </button>
          <p v-if="saveError" class="text-xs text-red-500">{{ saveError }}</p>
        </div>
      </div>

      <!-- Models -->
      <div>
        <div class="flex items-baseline justify-between mb-3">
          <h2 class="text-base font-semibold">Models</h2>
          <span class="text-xs text-[var(--app-muted)]">{{ detail.models.length }} total</span>
        </div>

        <!-- Add model — just the wire id; sync fills the rest from models.dev -->
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-2 mb-4">
          <div>
            <div class="text-sm font-medium">Add model</div>
            <div class="text-[11px] text-[var(--app-muted)] mt-0.5">
              Enter the provider's wire id (e.g. <span class="font-mono">claude-opus-4-7</span>). Context window, pricing, and capabilities are pulled from models.dev automatically.
            </div>
          </div>
          <div class="flex items-center gap-2">
            <input
              v-model="newModel.model_id"
              type="text"
              placeholder="claude-opus-4-7"
              class="flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm font-mono"
              @keydown.enter="addModel"
            />
            <button
              :disabled="!newModel.model_id.trim() || creatingModel"
              class="inline-flex items-center gap-2 rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              @click="addModel"
            >
              <Icon v-if="creatingModel" icon="lucide:loader-2" class="size-3.5 animate-spin" />
              <Icon v-else icon="lucide:plus" class="size-3.5" />
              Add
            </button>
          </div>
          <p v-if="modelError" class="text-xs text-red-500">{{ modelError }}</p>
          <p v-if="addNotice" class="text-xs text-[var(--app-muted)]">{{ addNotice }}</p>
        </div>

        <!-- Model table -->
        <div v-if="detail.models.length" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-[10px] uppercase tracking-wider text-[var(--app-muted)] border-b border-[var(--app-border)]">
                <th class="text-left px-3 py-2 font-medium">Model</th>
                <th class="text-center px-2 py-2 font-medium w-20" title="Exposed to users on API key mode">API</th>
                <th class="text-center px-2 py-2 font-medium w-20" title="Exposed to users on Monthly plan mode">Monthly</th>
                <th class="text-left px-2 py-2 font-medium w-28" title="Request-shape flags the operator honours when dispatching to this model">Spec</th>
                <th class="text-left px-2 py-2 font-medium w-28">Status</th>
                <th class="w-48" />
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--app-border)]">
              <template v-for="m in detail.models" :key="m.id">
                <tr>
                  <td class="px-3 py-2.5">
                    <div class="flex items-center gap-2">
                      <span class="font-medium">{{ m.name }}</span>
                      <span v-if="m.default" class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--app-accent)]/15 text-[var(--app-accent)]">default</span>
                      <span
                        v-if="m.tier_hint"
                        class="text-[10px] font-medium px-1.5 py-0.5 rounded font-mono uppercase"
                        :class="m.tier_hint === 'large'
                          ? 'bg-violet-500/15 text-violet-500'
                          : m.tier_hint === 'small'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-sky-500/15 text-sky-500'"
                      >{{ m.tier_hint }}</span>
                    </div>
                    <div class="text-xs text-[var(--app-muted)] font-mono">
                      {{ m.model_id }}<span v-if="m.context_window"> · {{ m.context_window.toLocaleString() }} ctx</span>
                      <span v-if="m.capabilities?.length"> · {{ m.capabilities.join(', ') }}</span>
                    </div>
                  </td>
                  <td class="text-center">
                    <input
                      type="checkbox"
                      :checked="m.available_on_api_key"
                      :disabled="pending[m.id]"
                      class="size-4"
                      @change="toggleModelMode(m, 'api_key')"
                    />
                  </td>
                  <td class="text-center">
                    <input
                      type="checkbox"
                      :checked="m.available_on_monthly"
                      :disabled="pending[m.id]"
                      class="size-4"
                      @change="toggleModelMode(m, 'monthly')"
                    />
                  </td>
                  <td class="px-2">
                    <span
                      :class="['text-[10px] font-medium px-1.5 py-0.5 rounded', toneClasses(specBadge(m).tone)]"
                      :title="m.request_spec ? JSON.stringify(m.request_spec) : 'No spec — operator uses its restrictive default'"
                    >
                      {{ specBadge(m).label }}
                    </span>
                  </td>
                  <td class="px-2">
                    <div class="flex flex-wrap items-center gap-1">
                      <span v-if="m.deprecated" class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">deprecated</span>
                      <span v-else-if="!m.enabled" class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)]">disabled</span>
                      <span v-else class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">enabled</span>
                      <span
                        v-if="m.locked"
                        class="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-500"
                        title="Manually edited — the models.dev sync will skip this row. Unlock to accept fresh upstream data."
                      >
                        <Icon icon="lucide:lock" class="size-2.5" />
                        locked
                      </span>
                    </div>
                  </td>
                  <td class="pr-3 py-2 text-right">
                    <div class="inline-flex gap-1">
                      <button
                        class="text-xs rounded-md border border-[var(--app-border)] px-2 py-1 hover:bg-[var(--app-card-hover)] disabled:opacity-50"
                        :disabled="pending[m.id]"
                        :class="{ 'bg-[var(--app-card-hover)]': editingSpecId === m.id }"
                        @click="editingSpecId === m.id ? closeSpecEditor() : openSpecEditor(m)"
                      >
                        Edit
                      </button>
                      <button
                        v-if="!m.locked"
                        class="text-xs rounded-md border border-[var(--app-border)] px-2 py-1 hover:bg-[var(--app-card-hover)] disabled:opacity-50 inline-flex items-center gap-1"
                        :disabled="pending[m.id]"
                        title="Pull latest data from models.dev for this model"
                        @click="syncModel(m)"
                      >
                        <Icon icon="lucide:refresh-cw" class="size-3" />
                        Sync
                      </button>
                      <button
                        v-else
                        class="text-xs rounded-md border border-[var(--app-border)] px-2 py-1 hover:bg-[var(--app-card-hover)] disabled:opacity-50 inline-flex items-center gap-1"
                        :disabled="pending[m.id]"
                        title="Clear the lock so the next sync can overwrite this row"
                        @click="unlockModel(m)"
                      >
                        <Icon icon="lucide:unlock" class="size-3" />
                        Unlock
                      </button>
                      <button class="text-xs rounded-md border border-[var(--app-border)] px-2 py-1 hover:bg-[var(--app-card-hover)] disabled:opacity-50" :disabled="pending[m.id]" @click="toggleModelEnabled(m)">
                        {{ m.enabled ? 'Disable' : 'Enable' }}
                      </button>
                      <button class="text-xs rounded-md border border-[var(--app-border)] px-2 py-1 hover:bg-[var(--app-card-hover)] disabled:opacity-50" :disabled="pending[m.id]" @click="toggleModelDeprecated(m)">
                        {{ m.deprecated ? 'Undeprecate' : 'Deprecate' }}
                      </button>
                      <button class="text-xs rounded-md border border-red-500/30 text-red-500 px-2 py-1 hover:bg-red-500/10 disabled:opacity-50" :disabled="pending[m.id]" @click="removeModel(m)">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="editingSpecId === m.id">
                  <td colspan="6" class="px-3 py-3 bg-[var(--app-surface)]">
                    <div class="flex flex-col gap-4">
                      <div class="flex items-center justify-between gap-3">
                        <div>
                          <h3 class="text-xs font-semibold">Settings for <span class="font-mono">{{ m.model_id }}</span></h3>
                          <p class="text-[11px] text-[var(--app-muted)] mt-0.5">
                            Context window, per-million-token pricing, and request-shape flags the operator honours when dispatching to this model.
                          </p>
                        </div>
                        <button
                          class="text-xs rounded-md border border-[var(--app-border)] px-2 py-1 hover:bg-[var(--app-card-hover)]"
                          @click="closeSpecEditor"
                        >
                          Close
                        </button>
                      </div>

                      <!-- Limits -->
                      <div>
                        <h4 class="text-[11px] font-semibold uppercase tracking-wider text-[var(--app-muted)] mb-2">Limits</h4>
                        <div class="grid grid-cols-2 gap-3">
                          <label class="flex flex-col gap-1 text-[11px] font-medium text-[var(--app-muted)]">
                            Context window (tokens)
                            <input v-model.number="settingsDraft.context_window" type="number" min="0" step="1000" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm font-mono" />
                          </label>
                          <label class="flex flex-col gap-1 text-[11px] font-medium text-[var(--app-muted)]">
                            Max output tokens
                            <input v-model.number="settingsDraft.max_output_tokens" type="number" min="0" step="1000" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm font-mono" />
                          </label>
                        </div>
                      </div>

                      <!-- Tier hint — suggests which L/M/S slot in the
                           desktop's per-provider settings should pick
                           this model as the default. -->
                      <div>
                        <h4 class="text-[11px] font-semibold uppercase tracking-wider text-[var(--app-muted)] mb-2">
                          Tier hint
                          <span class="text-[10px] font-normal normal-case">— suggests which L/M/S slot picks this model by default. Users can override.</span>
                        </h4>
                        <select v-model="settingsDraft.tier_hint" class="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm font-mono">
                          <option value="">— no hint —</option>
                          <option value="large">large</option>
                          <option value="medium">medium</option>
                          <option value="small">small</option>
                        </select>
                      </div>

                      <!-- Pricing -->
                      <div>
                        <h4 class="text-[11px] font-semibold uppercase tracking-wider text-[var(--app-muted)] mb-2">Pricing <span class="text-[10px] font-normal normal-case">— USD per 1M tokens. Zero = unpriced (free / plan-bundled).</span></h4>
                        <div class="grid grid-cols-2 gap-3">
                          <label class="flex flex-col gap-1 text-[11px] font-medium text-[var(--app-muted)]">
                            Input
                            <input v-model.number="settingsDraft.input_cost_per_1m" type="number" min="0" step="0.01" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm font-mono" />
                          </label>
                          <label class="flex flex-col gap-1 text-[11px] font-medium text-[var(--app-muted)]">
                            Output
                            <input v-model.number="settingsDraft.output_cost_per_1m" type="number" min="0" step="0.01" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm font-mono" />
                          </label>
                          <label class="flex flex-col gap-1 text-[11px] font-medium text-[var(--app-muted)]">
                            Cache read
                            <input v-model.number="settingsDraft.cache_read_cost_per_1m" type="number" min="0" step="0.01" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm font-mono" />
                          </label>
                          <label class="flex flex-col gap-1 text-[11px] font-medium text-[var(--app-muted)]">
                            Cache write
                            <input v-model.number="settingsDraft.cache_write_cost_per_1m" type="number" min="0" step="0.01" class="rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-sm font-mono" />
                          </label>
                        </div>
                      </div>

                      <!-- Request spec -->
                      <div>
                        <h4 class="text-[11px] font-semibold uppercase tracking-wider text-[var(--app-muted)] mb-2">Request spec <span class="text-[10px] font-normal normal-case">— empty uses restrictive default (no legacy params, adaptive thinking)</span></h4>

                        <div class="flex flex-wrap gap-2 mb-2">
                          <span class="text-[11px] text-[var(--app-muted)] self-center">Preset:</span>
                          <button
                            v-for="(preset, key) in SPEC_PRESETS"
                            :key="key"
                            class="text-[11px] rounded-md border border-[var(--app-border)] px-2 py-1 hover:bg-[var(--app-card-hover)]"
                            @click="applyPreset(key as keyof typeof SPEC_PRESETS)"
                          >
                            {{ preset.label }}
                          </button>
                          <button
                            class="text-[11px] rounded-md border border-[var(--app-border)] px-2 py-1 hover:bg-[var(--app-card-hover)]"
                            @click="specDraft = ''"
                          >
                            Clear
                          </button>
                        </div>

                        <textarea
                          v-model="specDraft"
                          rows="6"
                          spellcheck="false"
                          placeholder='{"accepts_temperature":true,"thinking":"fixed"}'
                          class="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-2 text-xs font-mono"
                        />
                      </div>

                      <p v-if="specError" class="text-xs text-red-500 flex items-center gap-1.5">
                        <Icon icon="lucide:alert-circle" class="size-3.5" />
                        {{ specError }}
                      </p>

                      <div class="flex items-center justify-end gap-2">
                        <button
                          class="text-xs rounded-md border border-[var(--app-border)] px-3 py-1.5 hover:bg-[var(--app-card-hover)]"
                          :disabled="specSaving"
                          @click="closeSpecEditor"
                        >
                          Cancel
                        </button>
                        <button
                          class="text-xs rounded-md bg-[var(--app-accent)] text-white px-3 py-1.5 disabled:opacity-50"
                          :disabled="specSaving"
                          @click="saveSpec(m)"
                        >
                          {{ specSaving ? 'Saving…' : 'Save' }}
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div v-else class="rounded-xl border border-dashed border-[var(--app-border)] p-8 text-center text-sm text-[var(--app-muted)]">
          No models yet — add one above.
        </div>
      </div>
    </template>
  </section>
</template>
