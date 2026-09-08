export interface DeliveryStats {
  messages: { total: number; sent: number; queued: number; failed: number; bounced: number }
  domains: { total: number; verified: number }
  keys: { total: number }
}

export interface DeliveryMessage {
  id: number
  user_id?: number
  domain_id?: number
  to_email: string
  from_email: string
  subject: string
  status: string
  error?: string | null
  sent_at?: string | null
  created_at: string
}

export interface SendingDomain {
  id: number
  user_id?: number
  domain: string
  status: string
  dkim_selector: string
  dkim_public_key: string
  dkim_verified: boolean
  spf_verified: boolean
  dmarc_verified: boolean
  created_at: string
}

export interface DNSRecord {
  name: string
  type: string
  value: string
  ttl?: number
}

export interface DomainDetailResponse {
  domain: SendingDomain
  dns_records: DNSRecord[]
}

export interface APIKey {
  id: number
  user_id?: number
  name: string
  prefix: string
  created_at: string
  last_used_at?: string | null
}

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

export function getStats() {
  return send<DeliveryStats>('GET', '/api/delivery/stats')
}

export interface ListMessagesParams {
  status?: string
  search?: string
  page?: number
  limit?: number
}

export interface ListMessagesResponse {
  data: DeliveryMessage[]
  total: number
  page: number
  limit: number
}

export function listMessages(params?: ListMessagesParams) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.search) qs.set('search', params.search)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return send<ListMessagesResponse>('GET', `/api/delivery/messages${suffix}`)
}

export function listDomains() {
  return send<{ domains: SendingDomain[] }>('GET', '/api/delivery/domains')
}

export function getDomain(id: number | string) {
  return send<DomainDetailResponse>('GET', `/api/delivery/domains/${id}`)
}

export function listDomainMessages(id: number | string) {
  return send<{ messages: DeliveryMessage[] }>('GET', `/api/delivery/domains/${id}/messages`)
}

export function verifyDomain(id: number | string) {
  return send<DomainDetailResponse>('POST', `/api/delivery/admin/domains/${id}/verify`)
}

export function listAPIKeys() {
  return send<{ keys: APIKey[] }>('GET', '/api/delivery/keys')
}

export interface DeliveryTenant {
  user_id: string
  messages_total: number
  messages_sent: number
  messages_queued: number
  messages_failed: number
  messages_bounced: number
  domains: number
  keys: number
  last_send_at?: string | null
}

export function listTenants() {
  return send<{ tenants: DeliveryTenant[] }>('GET', '/api/delivery/tenants')
}

// ─── Notifications (admin) ────────────────────────────────────────────────

export interface AdminNotification {
  id: string
  source: string
  type: string
  title: string
  body: string
  link?: string
  data?: unknown
  read_at?: string | null
  created_at: string
}

export interface ListNotificationsParams {
  user_id?: string
  source?: string
  type?: string
  unread?: boolean
  /** RFC3339; only items at or after this instant. */
  since?: string
  page?: number
  limit?: number
}

export interface ListNotificationsResponse {
  data: AdminNotification[]
  total: number
  page: number
  limit: number
}

export interface NotificationStatsBucket {
  key: string
  count: number
}

export interface NotificationStatsResponse {
  total: number
  unread: number
  read: number
  last_24h: number
  by_source: NotificationStatsBucket[]
  by_type: NotificationStatsBucket[]
  push_surfaces: {
    web_subscriptions: number
    device_tokens: number
    ios: number
    android: number
  }
}

export interface SendTestNotificationInput {
  user_id: string
  title: string
  body?: string
  link?: string
  source?: string
  type?: string
  data?: unknown
}

export function listNotifications(params?: ListNotificationsParams) {
  const qs = new URLSearchParams()
  if (params?.user_id) qs.set('user_id', params.user_id)
  if (params?.source) qs.set('source', params.source)
  if (params?.type) qs.set('type', params.type)
  if (params?.unread) qs.set('unread', 'true')
  if (params?.since) qs.set('since', params.since)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return send<ListNotificationsResponse>('GET', `/api/delivery/notifications${suffix}`)
}

export function getNotificationStats() {
  return send<NotificationStatsResponse>('GET', '/api/delivery/notifications/stats')
}

export function sendTestNotification(input: SendTestNotificationInput) {
  return send<AdminNotification>('POST', '/api/delivery/admin/notifications/test', input)
}
