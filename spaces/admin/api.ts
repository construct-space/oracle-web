export interface Administrator {
  id: number
  email: string
  first_name: string
  last_name: string
  username: string
  role: string
  active: boolean
  last_login?: string | null
  created_at?: string | null
}

export interface CreateAdministratorInput {
  email: string
  first_name: string
  last_name: string
  username: string
  password: string
  role: string
}

export interface UpdateAdministratorInput {
  email?: string
  first_name?: string
  last_name?: string
  username?: string
  role?: string
  active?: boolean
}

async function parse<T>(res: Response): Promise<T> {
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
  return parse<T>(res)
}

export function listAdministrators() {
  return send<{ data: Administrator[] }>('GET', '/api/administrators')
}

export function createAdministrator(input: CreateAdministratorInput) {
  return send<{ data: Administrator }>('POST', '/api/administrators', input)
}

export function updateAdministrator(id: number, input: UpdateAdministratorInput) {
  return send<{ data: Administrator }>('PATCH', `/api/administrators/${id}`, input)
}

export function deleteAdministrator(id: number) {
  return send<{ ok: boolean }>('DELETE', `/api/administrators/${id}`)
}

export function setAdministratorPassword(id: number, password: string) {
  return send<{ ok: boolean }>('POST', `/api/administrators/${id}/password`, { password })
}

// ─── Audit log ─────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number
  actor_administrator_id: number | null
  actor_email: string
  action: string
  resource_type: string
  resource_id: string
  metadata: string | null
  ip_address: string
  user_agent: string
  created_at: string
}

export interface ListAuditLogParams {
  actor_id?: number
  action?: string
  resource_type?: string
  resource_id?: string
  page?: number
  limit?: number
}

export interface ListAuditLogResponse {
  entries: AuditLogEntry[]
  total: number
  page: number
  limit: number
}

export function listAuditLog(params?: ListAuditLogParams) {
  const qs = new URLSearchParams()
  if (params?.actor_id) qs.set('actor_id', String(params.actor_id))
  if (params?.action) qs.set('action', params.action)
  if (params?.resource_type) qs.set('resource_type', params.resource_type)
  if (params?.resource_id) qs.set('resource_id', params.resource_id)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return send<ListAuditLogResponse>('GET', `/api/audit-log${suffix}`)
}
