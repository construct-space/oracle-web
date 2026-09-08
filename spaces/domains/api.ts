export interface DomainsStats {
  domains: { total: number; active: number; expired: number; expiring_soon: number }
  redirects: number
  tenants: number
}

export interface AdminDomain {
  id: number
  user_id: number
  user_uuid: string
  domain: string
  status: string
  auto_renew: boolean
  expire_date: string
  create_date: string
  security_lock: boolean
  whois_privacy: boolean
  nameservers: string
  created_at: string
  updated_at: string
}

export interface DNSRecord {
  id: number
  domain_id: number
  domain: string
  record_id: string
  name: string
  type: string
  content: string
  ttl: string
  prio: string
  notes: string
}

export interface DomainRedirect {
  id: number
  user_id: number
  source_domain: string
  target_domain: string
  redirect_type: number
  include_path: boolean
  created_at: string
  updated_at: string
}

export interface AdminDomainDetail {
  domain: AdminDomain
  dns: DNSRecord[]
  redirect: DomainRedirect | null
}

export interface DomainsTenant {
  user_uuid: string
  domains: number
  redirects: number
  expiring_soon: number
}

export interface ListDomainsParams {
  page?: number
  limit?: number
  status?: string
  search?: string
}

export interface ListRedirectsParams {
  page?: number
  limit?: number
  search?: string
}

export interface ListResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = text || `Request failed (${res.status})`
    try {
      const p = JSON.parse(text)
      if (p && typeof p.error === 'string') msg = p.error
    } catch {
      /* not JSON */
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

async function send<T>(method: string, path: string): Promise<T> {
  const res = await fetch(path, { method, credentials: 'include' })
  return readJson<T>(res)
}

export function getStats() {
  return send<DomainsStats>('GET', '/api/domains/stats')
}

export function listDomains(params?: ListDomainsParams) {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.status) qs.set('status', params.status)
  if (params?.search) qs.set('search', params.search)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return send<ListResponse<AdminDomain>>('GET', `/api/domains/domains${suffix}`)
}

export function getDomain(domain: string) {
  return send<AdminDomainDetail>('GET', `/api/domains/domains/${encodeURIComponent(domain)}`)
}

export function listRedirects(params?: ListRedirectsParams) {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.search) qs.set('search', params.search)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return send<ListResponse<DomainRedirect>>('GET', `/api/domains/redirects${suffix}`)
}

export function listTenants() {
  return send<{ tenants: DomainsTenant[] }>('GET', '/api/domains/tenants')
}
