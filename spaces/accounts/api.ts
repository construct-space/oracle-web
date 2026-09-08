export interface AccountUser {
  id: number
  uuid: string
  first_name: string
  last_name: string
  username: string
  email: string
  phone?: string | null
  totp_enabled: boolean
  suspended: boolean
  must_change_password: boolean
  developer_status?: string
  last_login?: string | null
  created_at: string
}

export interface AccountSession {
  id: number
  user_id: number
  user_agent?: string | null
  ip_address?: string | null
  expires_at: string
  created_at: string
}

export interface AccountOAuthClient {
  id: number
  client_id: string
  name: string
  redirect_uri: string
  description?: string | null
  active: boolean
  created_at: string
}

export interface AccountPasskey {
  id: number
  user_id: number
  name: string
  credential_id: string
  last_used_at?: string | null
  created_at: string
}

export interface AccountAccessToken {
  id: number
  client_id: string
  user_id: number
  scope: string
  expires_at: string
  revoked: boolean
  created_at: string
}

export interface AccountRefreshToken {
  id: number
  token: string
  client_id: string
  user_id: number
  scope: string
  expires_at: string
  revoked: boolean
  created_at: string
}

export interface AccountPreference {
  id: number
  user_id: number
  key: string
  value: string
}

export interface AccountUserDetail {
  data: AccountUser
  sessions: AccountSession[]
  passkeys: AccountPasskey[]
  access_tokens: AccountAccessToken[]
  refresh_tokens: AccountRefreshToken[]
  preferences: AccountPreference[]
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export interface ListUsersParams {
  search?: string
  status?: 'active' | 'suspended'
  totp?: 'enabled' | 'disabled'
  developer?: 'yes' | 'no'
  page?: number
  limit?: number
}

export interface ListUsersResponse {
  data: AccountUser[]
  total: number
  page: number
  limit: number
}

export async function listUsers(params?: ListUsersParams) {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.status) qs.set('status', params.status)
  if (params?.totp) qs.set('totp', params.totp)
  if (params?.developer) qs.set('developer', params.developer)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return readJson<ListUsersResponse>(await fetch(`/api/accounts/users${suffix}`, { credentials: 'include' }))
}

export async function getUser(id: string) {
  return readJson<AccountUserDetail>(await fetch(`/api/accounts/users/${id}`, { credentials: 'include' }))
}

export async function listSessions(params?: { user_id?: string; active_only?: boolean }) {
  const qs = new URLSearchParams()
  if (params?.user_id) qs.set('user_id', params.user_id)
  if (params?.active_only) qs.set('active_only', '1')
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return readJson<{ data: AccountSession[] }>(
    await fetch(`/api/accounts/sessions${suffix}`, { credentials: 'include' }),
  )
}

export async function listOAuthClients() {
  return readJson<{ data: AccountOAuthClient[] }>(
    await fetch('/api/accounts/oauth-clients', { credentials: 'include' }),
  )
}

export interface OAuthClientDetail {
  data: AccountOAuthClient
  authorizations: { user_id: number }[]
  active_tokens: number
  total_tokens: number
}

export async function getOAuthClient(id: number | string) {
  return readJson<OAuthClientDetail>(await fetch(`/api/accounts/oauth-clients/${id}`, { credentials: 'include' }))
}

export interface OAuthClientInput {
  name: string
  redirect_uri: string
  description?: string | null
  logo_url?: string | null
  active?: boolean
}

async function jsonRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return readJson<T>(res)
}

// Create returns the plaintext client_secret once — must be captured now.
export async function createOAuthClient(body: OAuthClientInput) {
  return jsonRequest<{ data: AccountOAuthClient; client_secret: string }>(
    'POST',
    '/api/accounts/admin/oauth-clients',
    body,
  )
}

export async function updateOAuthClient(id: number | string, body: Partial<OAuthClientInput>) {
  return jsonRequest<{ data: AccountOAuthClient }>('PATCH', `/api/accounts/admin/oauth-clients/${id}`, body)
}

export async function deleteOAuthClient(id: number | string) {
  return jsonRequest<{ ok: boolean }>('DELETE', `/api/accounts/admin/oauth-clients/${id}`)
}

// Returns the new plaintext secret once. All existing tokens are revoked.
export async function regenerateOAuthClientSecret(id: number | string) {
  return jsonRequest<{ client_secret: string; revoked_grants: boolean }>(
    'POST',
    `/api/accounts/admin/oauth-clients/${id}/regenerate-secret`,
  )
}

export async function revokeClientAuthorization(clientID: string, userID: number | string) {
  return jsonRequest<{ ok: boolean }>(
    'DELETE',
    `/api/accounts/admin/oauth-clients/${clientID}/authorizations/${userID}`,
  )
}

export async function postAccountAdmin(path: string, method: 'POST' | 'DELETE' = 'POST') {
  const res = await fetch(path, { method, credentials: 'include', headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed (${res.status})`)
  }
  return res
}

// ─── Construct credits ─────────────────────────────────────────────────────
//
// Provider-api owns the per-user Construct credit balance + ledger; oracle-api
// proxies these reads/writes under /api/provider/construct/users/{user_id}.
// The user_id is the accounts UUID (what the gateway injects as
// X-Auth-User-ID for every authenticated chat call).

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

const CONSTRUCT_BASE = '/api/provider/construct'

async function readConstructJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = text || `Request failed (${res.status})`
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed.error === 'string') message = parsed.error
    } catch { /* not JSON */ }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export async function getConstructUser(userUUID: string) {
  const res = await fetch(`${CONSTRUCT_BASE}/users/${userUUID}`, { credentials: 'include' })
  return readConstructJson<{ balance: ConstructBalance; ledger: ConstructLedgerRow[] }>(res)
}

export async function grantConstructCredits(userUUID: string, delta: number, reason: string) {
  const res = await fetch(`${CONSTRUCT_BASE}/users/${userUUID}/grant`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delta, reason }),
  })
  return readConstructJson<{ balance: ConstructBalance }>(res)
}

export async function blockConstructUser(userUUID: string, reason: string) {
  const res = await fetch(`${CONSTRUCT_BASE}/users/${userUUID}/block`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  return readConstructJson<{ ok: boolean }>(res)
}

export async function unblockConstructUser(userUUID: string) {
  const res = await fetch(`${CONSTRUCT_BASE}/users/${userUUID}/unblock`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
  return readConstructJson<{ ok: boolean }>(res)
}
