export interface DailyUsage {
  id: number
  user_id: number
  date: string
  country_code: string
  sessions: number
  active_minutes: number
  chats_sent: number
  tool_calls: number
  tokens_input: number
  tokens_output: number
  file_saves: number
  git_commits: number
  errors: number
}

export interface UserDevice {
  id: number
  user_id: number
  app_version: string
  os_type: string
  os_platform: string
  os_arch: string
  os_version: string
  country_code: string
  first_seen_at: string
  last_seen_at: string
}

export interface GeoRow {
  country_code: string
  active_users: number
  sessions: number
  active_minutes: number
}

export interface DailySpaceUsage {
  id: number
  user_id: number
  date: string
  space_id: string
  enter_count: number
  active_minutes: number
}

export interface DailyModelUsage {
  id: number
  user_id: number
  date: string
  provider: string
  model: string
  request_count: number
  tokens_input: number
  tokens_output: number
  cache_read: number
  cache_write: number
  tool_calls: number
  cost_usd: number
}

export interface DailyPerf {
  id: number
  user_id: number
  date: string
  metric: string
  count: number
  total_ms: number
  min_ms: number
  max_ms: number
}

export interface DailyError {
  id: number
  user_id: number
  date: string
  error_class: string
  count: number
}

export interface DailyToolUsage {
  id: number
  user_id: number
  date: string
  tool_name: string
  invocations: number
  success_count: number
  error_count: number
  total_ms: number
}

export interface ListResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface Summary {
  window_days: number
  totals: {
    Sessions: number
    ActiveMinutes: number
    TokensInput: number
    TokensOutput: number
    Errors: number
    ActiveUsers: number
  }
  active_today: number
  active_yesterday: number
  top_providers: Array<{
    provider: string
    cost_usd: number
    requests: number
    tokens_input: number
    tokens_output: number
  }>
  top_errors: Array<{ error_class: string; count: number }>
  os_mix: Array<{ os_type: string; count: number }>
}

export interface TrendPoint {
  date: string
  sessions: number
  active_users: number
  tokens_total: number
  cost_usd: number
  errors: number
}

export interface TopUser {
  user_id: number
  sessions: number
  active_minutes: number
  tokens_total: number
  errors: number
}

export interface TopModel {
  provider: string
  model: string
  requests: number
  tokens_input: number
  tokens_output: number
  cost_usd: number
}

export interface TopSpace {
  space_id: string
  enter_count: number
  active_minutes: number
  unique_users: number
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

function qs(p: Record<string, string | number | undefined>): string {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== '') s.set(k, String(v))
  }
  return s.toString() ? `?${s}` : ''
}

// ── Summary + trends (for Overview)
export const getSummary = (days?: number) => send<Summary>('GET', `/api/telemetry/summary${qs({ days })}`)
export const getTrends = (days?: number) =>
  send<{ data: TrendPoint[]; window_days: number }>('GET', `/api/telemetry/trends${qs({ days })}`)

// ── Top-N
export const getTopUsers = (days?: number, limit?: number) =>
  send<{ data: TopUser[]; window_days: number }>('GET', `/api/telemetry/top/users${qs({ days, limit })}`)
export const getTopModels = (days?: number, limit?: number) =>
  send<{ data: TopModel[]; window_days: number }>('GET', `/api/telemetry/top/models${qs({ days, limit })}`)
export const getTopSpaces = (days?: number, limit?: number) =>
  send<{ data: TopSpace[]; window_days: number }>('GET', `/api/telemetry/top/spaces${qs({ days, limit })}`)

// ── Paginated lists
export const listUsage = (p: Record<string, any>) =>
  send<ListResponse<DailyUsage>>('GET', `/api/telemetry/usage${qs(p)}`)
export const listDevices = (p: Record<string, any>) =>
  send<ListResponse<UserDevice>>('GET', `/api/telemetry/devices${qs(p)}`)
export const listSpaceUsage = (p: Record<string, any>) =>
  send<ListResponse<DailySpaceUsage>>('GET', `/api/telemetry/space-usage${qs(p)}`)
export const listModelUsage = (p: Record<string, any>) =>
  send<ListResponse<DailyModelUsage>>('GET', `/api/telemetry/model-usage${qs(p)}`)
export const listPerf = (p: Record<string, any>) => send<ListResponse<DailyPerf>>('GET', `/api/telemetry/perf${qs(p)}`)
export const listErrors = (p: Record<string, any>) =>
  send<ListResponse<DailyError>>('GET', `/api/telemetry/errors${qs(p)}`)
export const listTools = (p: Record<string, any>) =>
  send<ListResponse<DailyToolUsage>>('GET', `/api/telemetry/tools${qs(p)}`)

// ── Geo (country breakdown for the active-users map)
export const getGeo = (days?: number) =>
  send<{ data: GeoRow[]; window_days: number }>('GET', `/api/telemetry/geo${qs({ days })}`)

export interface GeoUserRow {
  user_id: number
  sessions: number
  active_minutes: number
  tokens_total: number
  errors: number
  last_active: string
}

export const getGeoUsers = (country: string, days?: number) =>
  send<{ data: GeoUserRow[]; country_code: string; window_days: number }>(
    'GET', `/api/telemetry/geo/users${qs({ country, days })}`,
  )
