export interface OrgListItem {
  id: string
  name: string
  slug: string
  icon: string
  owner_id: string
  developer_status: string
  member_count: number
  project_count: number
  team_count: number
  pending_invite_count: number
  created_at: string
  updated_at: string
}

export interface OrgDetail {
  data: {
    id: string
    name: string
    slug: string
    icon: string
    owner_id: string
    developer_status: string
    created_at: string
    updated_at: string
  }
  owner: { id: string; name: string; email: string } | null
  member_count: number
  project_count: number
  team_count: number
  pending_invite_count: number
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  name: string
  email: string
  avatar: string
  role: string
  status: string
  department_id: string | null
  joined_at: string
  last_active_at: string
  created_at: string
}

export interface OrgProject {
  id: string
  org_id: string
  name: string
  description: string
  repo_url: string
  default_branch: string
  framework: string
  visibility: string
  created_by: string
  member_count: number
  repo_count: number
  created_at: string
  updated_at: string
}

export interface OrgTeam {
  id: string
  org_id: string
  name: string
  description: string
  department_id: string | null
  lead_id: string | null
  member_count: number
  created_at: string
  updated_at: string
}

export interface OrgInvite {
  id: string
  org_id: string
  email: string
  role: string
  department_id: string | null
  invited_by: string
  token: string
  code: string
  status: string
  expires_at: string
  created_at: string
  updated_at: string
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

export interface ListOrgsParams {
  q?: string
  page?: number
  limit?: number
}
export interface ListOrgsResponse {
  orgs: OrgListItem[]
  total: number
  page: number
  limit: number
}

export function listOrgs(params?: ListOrgsParams) {
  const qs = new URLSearchParams()
  if (params?.q) qs.set('q', params.q)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return send<ListOrgsResponse>('GET', `/api/source/orgs${suffix}`)
}

export function getOrg(id: string) {
  return send<OrgDetail>('GET', `/api/source/orgs/${id}`)
}

export function listOrgMembers(id: string) {
  return send<{ members: OrgMember[]; total: number }>('GET', `/api/source/orgs/${id}/members`)
}

export function listOrgProjects(id: string) {
  return send<{ projects: OrgProject[]; total: number }>('GET', `/api/source/orgs/${id}/projects`)
}

export function listOrgTeams(id: string) {
  return send<{ teams: OrgTeam[]; total: number }>('GET', `/api/source/orgs/${id}/teams`)
}

export function listOrgInvites(id: string, status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return send<{ invites: OrgInvite[]; total: number }>('GET', `/api/source/orgs/${id}/invites${qs}`)
}

export function revokeInvite(id: string) {
  return send<{ ok: boolean }>('PUT', `/api/source/admin/org-invites/${id}/revoke`)
}

// ─── Feed items (homepage top strip) ─────────────────────────────────────

export type FeedBlockType = 'action' | 'announcement' | 'changelog' | 'tip' | 'update' | 'info'

export interface FeedItem {
  id: string
  type: FeedBlockType
  label?: string
  title?: string
  body?: string
  route?: string
  url?: string
  icon?: string
  items: string[]
  cols: number
  position: number
  active: boolean
  created_at: string
  updated_at: string
}

export type FeedItemInput = Omit<FeedItem, 'id' | 'created_at' | 'updated_at'> & { id?: string }

export function listFeedItems() {
  return send<{ items: FeedItem[] }>('GET', '/api/source/feed-items')
}

export function createFeedItem(body: FeedItemInput) {
  return send<{ item: FeedItem }>('POST', '/api/source/feed-items', body)
}

export function updateFeedItem(id: string, body: FeedItemInput) {
  return send<{ item: FeedItem }>('PATCH', `/api/source/feed-items/${id}`, body)
}

export function deleteFeedItem(id: string) {
  return send<{ status: string }>('DELETE', `/api/source/feed-items/${id}`)
}

export function reorderFeedItems(ids: string[]) {
  return send<{ status: string }>('POST', '/api/source/feed-items/reorder', { ids })
}
