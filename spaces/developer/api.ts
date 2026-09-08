export interface PublisherListItem {
  id: number
  name: string
  email: string
  kind: 'user' | 'org' | 'legacy' | string
  verified: boolean
  space_count: number
  created_at: string | null
  website?: string
  avatar_url?: string
}

export interface PublisherDetail {
  id: number
  name: string
  email: string
  kind: string
  verified: boolean
  api_key: string
  spaces: SpaceSummary[]
  created_at: string | null
  website?: string
  avatar_url?: string
  user_id?: string
  org_id?: string
}

export interface SpaceSummary {
  id: number | string
  name: string
  display_name?: string
  description?: string
  author?: string
  status?: string
  version?: string
  icon?: string
  scope?: string
  publisher_name?: string
  recommended?: boolean
  updated_at?: string
  created_at?: string
  // Graph-side fields, present only when the row came from the graph
  // admin endpoint (now the source of truth for All Spaces). Distinguish
  // "exists on graph but never submitted to marketplace" from "was
  // submitted and is in some marketplace state".
  bundle_id?: string
  distribution?: string
  install_count?: number
  publisher_org_id?: string
}

export interface SpaceDetail extends SpaceSummary {
  reviewer_notes?: string
  reviewed_at?: string | null
  build_size?: number
  build_duration?: number
  ownerUserId?: string
  ownerOrgId?: string
  publisher_info?: {
    id: number
    name: string
    email: string
    kind: string
    verified: boolean
  }
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = text || `Request failed (${res.status})`
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed.error === 'string') message = parsed.error
    } catch {
      /* text wasn't JSON */
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

// ─── Publishers ────────────────────────────────────────────────────────────

export interface ListPublishersParams {
  q?: string
  kind?: 'user' | 'org' | 'legacy'
  verified?: 'true' | 'false'
  page?: number
  limit?: number
}

export interface ListPublishersResponse {
  publishers: PublisherListItem[]
  total: number
  page: number
  limit: number
}

export function listPublishers(params?: ListPublishersParams) {
  const qs = new URLSearchParams()
  if (params?.q) qs.set('q', params.q)
  if (params?.kind) qs.set('kind', params.kind)
  if (params?.verified) qs.set('verified', params.verified)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return send<ListPublishersResponse>('GET', `/api/developer/publishers${suffix}`)
}

export function getPublisher(id: number | string) {
  return send<PublisherDetail>('GET', `/api/developer/publishers/${id}`)
}

export function verifyPublisher(id: number | string) {
  return send<{ ok?: boolean }>('PUT', `/api/developer/admin/publishers/${id}/verify`)
}

export function unverifyPublisher(id: number | string) {
  return send<{ ok?: boolean }>('PUT', `/api/developer/admin/publishers/${id}/unverify`)
}

// ─── Spaces ────────────────────────────────────────────────────────────────

export interface ListSpacesResponse {
  spaces: SpaceSummary[]
  total: number
}

export function listPendingSpaces() {
  return send<ListSpacesResponse>('GET', '/api/developer/spaces/pending')
}

// All Spaces is now graph-sourced — graph is the canonical "spaces
// exist" registry; developer's table is the marketplace-lifecycle
// subset. Pair this with batchSpaceStatus to overlay status / publisher
// info on the rows that did go through review.
export interface GraphSpaceRow {
  id: string
  name: string
  latest_version?: string
  bundle_id?: string
  distribution?: string
  publisher_org_id?: string
  install_count?: number
}

export function listAllSpaces() {
  return send<{ spaces: GraphSpaceRow[]; total: number }>('GET', '/api/graph/admin/spaces')
}

// Graph admin: runtime stats + provisioned schemas. Read endpoints feed
// the Graph page; the delete cascades schemas + manifests + spaces row
// for an orphan / never-submitted space.
export interface GraphStats {
  schemas: number
  tables: number
  rows: number
  size: string
}

export interface GraphSchemaRow {
  space_id: string
  project_id: string
  schema_name: string
  manifest_version: string
  provisioned_at: string
}

export function getGraphStats() {
  return send<GraphStats>('GET', '/api/graph/admin/stats')
}

export function listGraphSchemas() {
  return send<{ schemas: GraphSchemaRow[] }>('GET', '/api/graph/admin/schemas')
}

export function deleteGraphSpace(spaceId: string) {
  return send<{ ok: boolean; dropped: string[] }>('DELETE', `/api/graph/admin/spaces/${encodeURIComponent(spaceId)}`)
}

export function deleteGraphSchema(name: string) {
  return send<{ ok: boolean; dropped: string }>('DELETE', `/api/graph/admin/schemas/${encodeURIComponent(name)}`)
}

// Models live at the space level (definitions are shared across the space's
// projects); each model maps to a SQL table inside the schema.
export interface GraphModelField {
  name: string
  type: string
  required?: boolean
  unique?: boolean
  default?: unknown
  index?: boolean
  validation?: string
  values?: string[]
  // Relation fields
  relation?: string  // belongsTo, hasMany
  target?: string    // target model name
  on_delete?: string
  nullable?: boolean
}

export interface GraphModel {
  name: string
  fields: GraphModelField[]
  options?: {
    scope?: string
    access?: { read?: string; create?: string; update?: string; delete?: string }
  }
}

export function getGraphModels(spaceId: string) {
  return send<{ space_id: string; models: GraphModel[] }>(
    'GET',
    `/api/graph/admin/schemas/${encodeURIComponent(spaceId)}/models`,
  )
}

// Read rows from a single table inside a provisioned schema. Used by the
// data drawer + CSV export. Server caps limit at 200; for full-table
// export the caller paginates.
export interface GraphTableRowsResponse {
  schema: string
  table: string
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
  limit: number
  offset: number
}

export function getGraphTableRows(
  schemaName: string,
  tableName: string,
  opts: { limit?: number; offset?: number } = {},
) {
  const params = new URLSearchParams()
  if (opts.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts.offset !== undefined) params.set('offset', String(opts.offset))
  const qs = params.toString()
  return send<GraphTableRowsResponse>(
    'GET',
    `/api/graph/admin/schemas/${encodeURIComponent(schemaName)}/tables/${encodeURIComponent(tableName)}/rows${qs ? `?${qs}` : ''}`,
  )
}

export interface SpaceStatusInfo {
  id: number
  status?: string
  version?: string
  recommended?: boolean
  buildSize?: number
  reviewedAt?: string
  updatedAt?: string
  submittedBy?: string
  ownerUserId?: string
  ownerOrgId?: string
  publisher?: {
    id?: number
    name: string
    email?: string
    kind?: string
    verified?: boolean
  }
}

export function batchSpaceStatus(names: string[]) {
  return send<{ statuses: Record<string, SpaceStatusInfo> }>('POST', '/api/developer/admin/spaces/status', { names })
}

export function getSpace(id: number | string) {
  return send<SpaceDetail>('GET', `/api/developer/spaces/${id}`)
}

export function approveSpace(id: number | string) {
  return send<{ message: string; id: number }>('POST', `/api/developer/admin/spaces/${id}/approve`)
}

export function rejectSpace(id: number | string, reason?: string) {
  return send<{ message: string; id: number }>('POST', `/api/developer/admin/spaces/${id}/reject`, { reason })
}

export function requestChangesSpace(id: number | string, note?: string) {
  return send<{ message: string; id: number }>('POST', `/api/developer/admin/spaces/${id}/request-changes`, { note })
}

export function unpublishSpace(id: number | string, reason?: string) {
  return send<{ message: string; id: number }>('POST', `/api/developer/admin/spaces/${id}/unpublish`, { reason })
}

export function toggleRecommended(id: number | string) {
  return send<{ id: number; recommended: boolean }>('POST', `/api/developer/admin/spaces/${id}/toggle-recommended`)
}

export function transferSpace(id: number | string, target: { to_user_id?: string; to_org_id?: string }) {
  return send<{ message: string; id: string; ownerUserId?: string; ownerOrgId?: string }>(
    'POST', `/api/developer/admin/spaces/${id}/transfer`, target,
  )
}

export function updateSpace(id: number | string, body: Partial<SpaceSummary>) {
  return send<{ data?: SpaceDetail }>('PUT', `/api/developer/admin/spaces/${id}`, body)
}

// Hard-delete a space row. Unlike unpublish (which flips status to draft
// and keeps the record), this removes the row entirely. Bundles and graph
// schemas are not purged — those belong to other services.
export function deleteSpace(id: number | string) {
  return send<{ message: string; id: number | string }>('DELETE', `/api/developer/admin/spaces/${id}`)
}

// ─── Publish history ───────────────────────────────────────────────────────

export interface SpacePublishItem {
  id: number
  spaceId: number
  version: string
  publisherUserId: string
  ownerUserId?: string
  ownerOrgId?: string
  publishedAt: string
  buildSize: number
  hasSource: boolean
  bundleUrl?: string
  buildChecksum?: string
  buildDuration?: string
  publisher?: {
    name: string
    email: string
    kind: string
  }
}

export interface ListPublishesResponse {
  publishes: SpacePublishItem[]
  total: number
}

export function listSpacePublishes(id: number | string) {
  return send<ListPublishesResponse>('GET', `/api/developer/admin/spaces/${id}/publishes`)
}

// Source-download helpers return the URL — the page uses an <a> + native
// browser download (or window.location) rather than reading the body into
// JS, since archives can be large.
export function spaceLatestSourceURL(id: number | string): string {
  return `/api/developer/admin/spaces/${id}/source`
}

export function publishSourceURL(publishId: number | string): string {
  return `/api/developer/admin/publishes/${publishId}/source`
}
