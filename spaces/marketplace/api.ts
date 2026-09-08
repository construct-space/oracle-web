// api.ts — HTTP client for /api/marketplace/* (oracle-api proxy in
// front of marketplace-api). All calls credentials:'include' so the
// session cookie set by oracle-api login flows through.

export interface MarketplaceSpace {
  id: string                // slug, primary key
  name: string              // display name
  description: string
  icon: string
  version: string
  host_api_version?: string
  manifest?: Record<string, unknown>
  tarball_url?: string
  scope?: string
  publisher_slug?: string
  publisher_name?: string
  category?: string | null
  tags?: string[]
  downloads?: number
  installs_7d?: number
  installs_30d?: number
  promoted_at?: string
  updated_at?: string
  demoted_at?: string
}

export interface ListSpacesResponse {
  spaces: MarketplaceSpace[]
  page: number
  pageSize: number
  total: number
}

export interface Category {
  slug: string
  title: string
  description?: string
  icon?: string
  position?: number
  visible?: boolean
  created_at?: string
  updated_at?: string
}

export interface Collection {
  id: string
  slug: string
  title: string
  subtitle?: string
  hero_image_url?: string
  kind: 'manual' | 'dynamic'
  query?: Record<string, unknown>
  priority?: number
  active_from?: string | null
  active_to?: string | null
  created_by?: string
  created_at?: string
  updated_at?: string
}

export interface CollectionDetail {
  collection: Collection
  spaces: MarketplaceSpace[]
}

export interface EditorialOverride {
  space_id: string
  blurb?: string
  hero_image_url?: string
  title?: string
  pinned?: boolean
  updated_by?: string
  updated_at?: string
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    let message = `${res.status} ${res.statusText}`
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed.error === 'string') message = parsed.error
    } catch {
      /* not json */
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

// ─── Spaces ────────────────────────────────────────────────────────────

export interface ListSpacesParams {
  q?: string
  category?: string
  page?: number
  pageSize?: number
  includeDemoted?: boolean
}

export function listSpaces(params?: ListSpacesParams) {
  const qs = new URLSearchParams()
  if (params?.q) qs.set('q', params.q)
  if (params?.category) qs.set('category', params.category)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize))
  if (params?.includeDemoted) qs.set('includeDemoted', 'true')
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return send<ListSpacesResponse>('GET', `/api/marketplace/spaces${suffix}`)
}

export function patchSpace(name: string, body: { category?: string | null; tags?: string[] }) {
  return send<{ ok: boolean }>('PATCH', `/api/marketplace/spaces/${encodeURIComponent(name)}`, body)
}

export function getEditorial(name: string) {
  return send<EditorialOverride>('GET', `/api/marketplace/spaces/${encodeURIComponent(name)}/editorial`)
}

export function setEditorial(name: string, body: Partial<EditorialOverride>) {
  return send<EditorialOverride>('PUT', `/api/marketplace/spaces/${encodeURIComponent(name)}/editorial`, body)
}

// ─── Categories ────────────────────────────────────────────────────────

export function listCategories() {
  return send<{ categories: Category[] }>('GET', '/api/marketplace/categories')
}

export function createCategory(c: Category) {
  return send<Category>('POST', '/api/marketplace/categories', c)
}

export function updateCategory(slug: string, c: Category) {
  return send<Category>('PUT', `/api/marketplace/categories/${encodeURIComponent(slug)}`, c)
}

export function deleteCategory(slug: string) {
  return send<{ ok: boolean }>('DELETE', `/api/marketplace/categories/${encodeURIComponent(slug)}`)
}

// ─── Collections ───────────────────────────────────────────────────────

export function listCollections() {
  return send<{ collections: Collection[] }>('GET', '/api/marketplace/collections')
}

export function getCollection(id: string) {
  return send<CollectionDetail>('GET', `/api/marketplace/collections/${encodeURIComponent(id)}`)
}

export function createCollection(c: Partial<Collection>) {
  return send<Collection>('POST', '/api/marketplace/collections', c)
}

export function updateCollection(id: string, c: Partial<Collection>) {
  return send<Collection>('PUT', `/api/marketplace/collections/${encodeURIComponent(id)}`, c)
}

export function deleteCollection(id: string) {
  return send<{ ok: boolean }>('DELETE', `/api/marketplace/collections/${encodeURIComponent(id)}`)
}

export function addSpaceToCollection(id: string, spaceName: string, position = 0) {
  return send<{ collection_id: string; space_id: string; position: number }>(
    'POST',
    `/api/marketplace/collections/${encodeURIComponent(id)}/spaces`,
    { space_name: spaceName, position },
  )
}

export function removeSpaceFromCollection(id: string, spaceName: string) {
  return send<{ ok: boolean }>(
    'DELETE',
    `/api/marketplace/collections/${encodeURIComponent(id)}/spaces/${encodeURIComponent(spaceName)}`,
  )
}

export function reorderCollection(id: string, order: string[]) {
  return send<{ ok: boolean }>(
    'PUT',
    `/api/marketplace/collections/${encodeURIComponent(id)}/order`,
    { order },
  )
}
