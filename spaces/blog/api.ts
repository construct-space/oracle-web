// api.ts — HTTP client for /api/blog/* (oracle-api). All calls
// credentials:'include' so the staff session cookie flows through.
// Admin endpoints are used here; the public read endpoints are consumed
// by the lisaos.dev website, not this UI.

export interface BlogPost {
  id: number
  slug: string
  title: string
  excerpt?: string
  content?: string
  cover_image?: string
  tags?: string // comma-separated
  author?: string
  status: 'draft' | 'published'
  published_at?: string | null
  created_at?: string
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

export function listPosts() {
  return send<{ posts: BlogPost[] }>('GET', '/api/admin/blog/posts')
}

export function getPost(id: number | string) {
  return send<BlogPost>('GET', `/api/admin/blog/posts/${encodeURIComponent(String(id))}`)
}

export function createPost(body: Partial<BlogPost>) {
  return send<BlogPost>('POST', '/api/admin/blog/posts', body)
}

export function updatePost(id: number | string, body: Partial<BlogPost>) {
  return send<BlogPost>('PATCH', `/api/admin/blog/posts/${encodeURIComponent(String(id))}`, body)
}

export function deletePost(id: number | string) {
  return send<{ ok: boolean }>('DELETE', `/api/admin/blog/posts/${encodeURIComponent(String(id))}`)
}

export function publishPost(id: number | string) {
  return send<BlogPost>('POST', `/api/admin/blog/posts/${encodeURIComponent(String(id))}/publish`)
}

export function unpublishPost(id: number | string) {
  return send<BlogPost>('POST', `/api/admin/blog/posts/${encodeURIComponent(String(id))}/unpublish`)
}
