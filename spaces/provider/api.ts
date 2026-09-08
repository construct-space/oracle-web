// Provider catalog admin client.
// Moved out of `@spaces/source` on 2026-05-11 when the catalog backend
// moved from source-api to provider-api. Oracle-api exposes the same
// admin endpoints under /api/provider/providers/* and proxies them to
// provider-api (X-Internal-Secret signed).

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = text || `Request failed (${res.status})`
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed.error === 'string') message = parsed.error
    } catch {
      /* not JSON */
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return readJson<T>(res)
}

// ─── Types ───────────────────────────────────────────────────────────────

export interface ProviderApiKeyMode {
  enabled: boolean
  base_url: string
  env_keys: string[] | null
  docs_url: string
  signup_url: string
  has_shared_key: boolean
}

export interface ProviderMonthlyMode {
  enabled: boolean
  auth_type: string
  base_url: string
  oauth_config: Record<string, unknown> | null
  docs_url: string
  signup_url: string
}

export interface ProviderListItem {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  capabilities: string[] | null
  enabled: boolean
  min_app_version: string
  sort_order: number
  api_key: ProviderApiKeyMode
  monthly: ProviderMonthlyMode
  model_count: number
  created_at: string
  updated_at: string
}

export interface ProviderModel {
  id: string
  provider_id: string
  model_id: string
  name: string
  capabilities: string[] | null
  context_window: number
  max_output_tokens: number
  input_cost_per_1m: number
  output_cost_per_1m: number
  cache_read_cost_per_1m: number
  cache_write_cost_per_1m: number
  available_on_api_key: boolean
  available_on_monthly: boolean
  enabled: boolean
  default: boolean
  deprecated: boolean
  replaced_by: string
  min_app_version: string
  sort_order: number
  /** Set to true whenever an admin saves through the edit drawer. Sync
   *  skips locked rows so manual tweaks aren't clobbered. */
  locked: boolean
  request_spec: RequestSpec | null
  /** Suggests which tier slot in the desktop's per-provider settings
   *  should default to this model. The desktop can override. */
  tier_hint: '' | 'large' | 'medium' | 'small'
  created_at: string
  updated_at: string
}

/**
 * Per-model request-shape flags the operator reads at dispatch time.
 * Empty / null → operator falls back to its restrictive default (no
 * legacy params, adaptive thinking).
 */
export interface RequestSpec {
  accepts_temperature?: boolean
  accepts_top_p?: boolean
  accepts_top_k?: boolean
  accepts_prefill?: boolean
  thinking?: 'none' | 'fixed' | 'adaptive'
}

export interface ProviderDetail {
  provider: ProviderListItem
  models: ProviderModel[]
}

export interface ApiKeyModeInput {
  enabled?: boolean
  base_url?: string
  env_keys?: string[]
  docs_url?: string
  signup_url?: string
  has_shared_key?: boolean
}

export interface MonthlyModeInput {
  enabled?: boolean
  auth_type?: string
  base_url?: string
  oauth_config?: Record<string, unknown>
  docs_url?: string
  signup_url?: string
}

export interface ProviderInput {
  id?: string
  slug?: string
  name?: string
  description?: string
  icon?: string
  capabilities?: string[]
  enabled?: boolean
  min_app_version?: string
  sort_order?: number
  api_key?: ApiKeyModeInput
  monthly?: MonthlyModeInput
}

export interface ProviderModelInput {
  id?: string
  model_id?: string
  name?: string
  capabilities?: string[]
  context_window?: number
  max_output_tokens?: number
  input_cost_per_1m?: number
  output_cost_per_1m?: number
  cache_read_cost_per_1m?: number
  cache_write_cost_per_1m?: number
  available_on_api_key?: boolean
  available_on_monthly?: boolean
  enabled?: boolean
  default?: boolean
  deprecated?: boolean
  replaced_by?: string
  min_app_version?: string
  sort_order?: number
  request_spec?: RequestSpec | null
  tier_hint?: '' | 'large' | 'medium' | 'small'
}

// ─── Calls ───────────────────────────────────────────────────────────────

const BASE = '/api/provider/providers'

export function listProviders() {
  return send<{ providers: ProviderListItem[]; total: number; version: string }>('GET', BASE)
}

export function getProvider(id: string) {
  return send<ProviderDetail>('GET', `${BASE}/${id}`)
}

export function createProvider(body: ProviderInput) {
  return send<{ provider: ProviderListItem }>('POST', BASE, body)
}

export function updateProvider(id: string, body: ProviderInput) {
  return send<{ provider: ProviderListItem }>('PUT', `${BASE}/${id}`, body)
}

export function deleteProvider(id: string) {
  return send<{ ok: boolean }>('DELETE', `${BASE}/${id}`)
}

export function listProviderModels(providerId: string) {
  return send<{ models: ProviderModel[]; total: number }>('GET', `${BASE}/${providerId}/models`)
}

export function createProviderModel(providerId: string, body: ProviderModelInput) {
  return send<{ model: ProviderModel }>('POST', `${BASE}/${providerId}/models`, body)
}

export function updateProviderModel(providerId: string, modelId: string, body: ProviderModelInput) {
  return send<{ model: ProviderModel }>('PUT', `${BASE}/${providerId}/models/${modelId}`, body)
}

export function deleteProviderModel(providerId: string, modelId: string) {
  return send<{ ok: boolean }>('DELETE', `${BASE}/${providerId}/models/${modelId}`)
}

/** Pulls fresh data for this one model from models.dev and overwrites
 *  the row — unless the row is locked (admin has hand-edited), in which
 *  case the server returns 409 with {locked: true}. */
export function syncProviderModel(providerId: string, modelId: string) {
  return send<{ model: ProviderModel }>('POST', `${BASE}/${providerId}/models/${modelId}/sync`)
}

/** Clears the locked flag so the next sync can overwrite. */
export function unlockProviderModel(providerId: string, modelId: string) {
  return send<{ model: ProviderModel }>('POST', `${BASE}/${providerId}/models/${modelId}/unlock`)
}

// ─── Construct — managed upstream providers ──────────────────────────────

const CONSTRUCT_BASE = '/api/provider/construct'

export interface ConstructUpstream {
  id: string
  label: string
  base_url: string
  auth_header: string
  /** "configured" when a key is set; never the raw value. */
  api_key: string
  enabled: boolean
  updated_at: string
  updated_by: string
}

export interface ConstructUpstreamInput {
  id?: string
  label?: string
  base_url?: string
  auth_header?: string
  /** Plaintext at submit time; encrypted at rest. Send empty/undefined to leave existing key untouched. */
  api_key?: string
  enabled?: boolean
}

export function listConstructUpstreams() {
  return send<{ upstreams: ConstructUpstream[]; total: number }>('GET', `${CONSTRUCT_BASE}/upstreams`)
}

export function createConstructUpstream(body: ConstructUpstreamInput) {
  return send<{ upstream: ConstructUpstream }>('POST', `${CONSTRUCT_BASE}/upstreams`, body)
}

export function updateConstructUpstream(id: string, body: ConstructUpstreamInput) {
  return send<{ upstream: ConstructUpstream }>('PUT', `${CONSTRUCT_BASE}/upstreams/${id}`, body)
}

export function deleteConstructUpstream(id: string) {
  return send<{ ok: boolean }>('DELETE', `${CONSTRUCT_BASE}/upstreams/${id}`)
}

// ─── Construct — picker entries ──────────────────────────────────────────
//
// User-facing chat models shown in the desktop picker. Today there is
// exactly one entry (`source`) that fans out via Source-family routing.

export interface PickerEntry {
  id: string
  label: string
  description: string
  icon: string
  /** Source-family operator this picker entry dispatches through for
   *  the medium / default tier. Chat handler reads source_family_routes
   *  WHERE operator_id = this. Default 'tank'. */
  route_via_operator: string
  /** Optional per-tier overrides. When the chat request carries
   *  `tier: 'large'` or `'small'` and the corresponding column is set,
   *  the dispatcher walks that operator's chain instead. Empty string
   *  = fall back to the medium operator. */
  route_via_operator_large: string
  route_via_operator_small: string
  capabilities: string[] | null
  enabled: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PickerEntryInput {
  id?: string
  label?: string
  description?: string
  icon?: string
  route_via_operator?: string
  route_via_operator_large?: string
  route_via_operator_small?: string
  capabilities?: string[]
  enabled?: boolean
  sort_order?: number
}

export function listPickerEntries() {
  return send<{ entries: PickerEntry[]; total: number }>('GET', `${CONSTRUCT_BASE}/picker-entries`)
}

export function createPickerEntry(body: PickerEntryInput) {
  return send<{ entry: PickerEntry }>('POST', `${CONSTRUCT_BASE}/picker-entries`, body)
}

export function updatePickerEntry(id: string, body: PickerEntryInput) {
  return send<{ entry: PickerEntry }>('PUT', `${CONSTRUCT_BASE}/picker-entries/${id}`, body)
}

export function deletePickerEntry(id: string) {
  return send<{ ok: boolean }>('DELETE', `${CONSTRUCT_BASE}/picker-entries/${id}`)
}

// ─── Construct — routing targets ─────────────────────────────────────────
//
// Internal aliases (Apoc, Trinity, …) bound to one upstream + model id +
// per-target cost / caps / thinking mode. Source-family routes reference
// these by id, so renaming an upstream is one row edit, not many.

export interface RoutingTarget {
  id: string
  upstream_provider_id: string
  upstream_model: string
  label: string
  description: string
  icon: string
  credits_per_prompt: number
  max_tool_calls_per_credit: number
  max_output_tokens_per_credit: number
  thinking_mode: string
  capabilities: string[] | null
  enabled: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface RoutingTargetInput {
  id?: string
  upstream_provider_id?: string
  upstream_model?: string
  label?: string
  description?: string
  icon?: string
  credits_per_prompt?: number
  max_tool_calls_per_credit?: number
  max_output_tokens_per_credit?: number
  thinking_mode?: string
  capabilities?: string[]
  enabled?: boolean
  sort_order?: number
}

export function listRoutingTargets() {
  return send<{ targets: RoutingTarget[]; total: number }>('GET', `${CONSTRUCT_BASE}/routing-targets`)
}

export function createRoutingTarget(body: RoutingTargetInput) {
  return send<{ target: RoutingTarget }>('POST', `${CONSTRUCT_BASE}/routing-targets`, body)
}

export function updateRoutingTarget(id: string, body: RoutingTargetInput) {
  return send<{ target: RoutingTarget }>('PUT', `${CONSTRUCT_BASE}/routing-targets/${id}`, body)
}

export function deleteRoutingTarget(id: string) {
  return send<{ ok: boolean }>('DELETE', `${CONSTRUCT_BASE}/routing-targets/${id}`)
}

// ─── Construct — global config ───────────────────────────────────────────

export interface ConstructConfig {
  id: number
  daily_allowance: number
  enabled: boolean
  updated_at: string
  updated_by: string
}

export function getConstructConfig() {
  return send<{ config: ConstructConfig }>('GET', `${CONSTRUCT_BASE}/config`)
}

export function updateConstructConfig(body: { daily_allowance?: number; enabled?: boolean }) {
  return send<{ config: ConstructConfig }>('PUT', `${CONSTRUCT_BASE}/config`, body)
}

// ─── Construct — per-user actions ────────────────────────────────────────

export interface ConstructBalance {
  user_id: string
  daily_used: number
  daily_date: string
  paid_balance: number
  blocked: boolean
  blocked_reason: string
  updated_at: string
}

export interface ConstructLedgerRow {
  id: number
  user_id: string
  delta: number
  kind: string
  prompt_id: string
  meta: string
  created_at: string
}

export function getConstructUser(id: string) {
  return send<{ balance: ConstructBalance; ledger: ConstructLedgerRow[] }>('GET', `${CONSTRUCT_BASE}/users/${id}`)
}

export function grantConstructCredits(id: string, delta: number, reason: string) {
  return send<{ balance: ConstructBalance }>('POST', `${CONSTRUCT_BASE}/users/${id}/grant`, { delta, reason })
}

export function blockConstructUser(id: string, reason: string) {
  return send<{ ok: boolean }>('POST', `${CONSTRUCT_BASE}/users/${id}/block`, { reason })
}

export function unblockConstructUser(id: string) {
  return send<{ ok: boolean }>('POST', `${CONSTRUCT_BASE}/users/${id}/unblock`)
}

// ─── Source-family routing ───────────────────────────────────────────────
//
// Rows-with-priority schema. Backend stores one row per
// (operator_id, slot, position, model_id); the API groups rows by
// operator for the UI so each call returns a populated SourceFamilyOperator
// view with the four slot buckets.

const SOURCE_FAMILY_BASE = '/api/provider/source-family'

export interface SourceFamilyRouteRef {
  id: number
  model_id: string
  position: number
}

export interface SourceFamilyOperator {
  operator_id: string
  /** Derived from which slots are populated. "moa" when aggregator/proposers
   *  are set, otherwise "single". */
  kind: 'single' | 'moa'
  primary: SourceFamilyRouteRef | null
  backups: SourceFamilyRouteRef[]
  aggregator: SourceFamilyRouteRef | null
  proposers: SourceFamilyRouteRef[]
}

/** PUT body — full replacement of one operator's routes. Send ordered
 *  arrays of construct_models.id values; the server deletes existing
 *  rows and inserts the new set in one transaction. */
export interface SourceFamilyOperatorInput {
  primary?: string
  backups?: string[]
  aggregator?: string
  proposers?: string[]
}

export function listSourceFamily() {
  return send<{ operators: SourceFamilyOperator[]; total: number }>('GET', SOURCE_FAMILY_BASE)
}

export function getSourceFamilyOperator(id: string) {
  return send<SourceFamilyOperator>('GET', `${SOURCE_FAMILY_BASE}/${id}`)
}

export function upsertSourceFamilyOperator(id: string, body: SourceFamilyOperatorInput) {
  return send<SourceFamilyOperator>('PUT', `${SOURCE_FAMILY_BASE}/${id}`, body)
}

export function deleteSourceFamilyOperator(id: string) {
  return send<null>('DELETE', `${SOURCE_FAMILY_BASE}/${id}`)
}

