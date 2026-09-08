import { computed, onMounted, type Ref, ref, watch } from 'vue'
import { getOrg, type OrgDetail } from './api'

/**
 * Shared loader for the organization header + counts used on every
 * /source/organizations/:id/* page.
 *
 * The Dispatcher remounts the active tab when the route changes, so without a
 * cache every tab click triggers a fresh `getOrg` call — the UI flashes a
 * "Loading organization…" placeholder even though the identity hasn't changed.
 * Cache by id so tab switches are synchronous; background-refresh on mount
 * keeps counts current without the flash.
 */
const cache = new Map<string, OrgDetail>()

export function useOrgContext(idRef: Ref<string>) {
  const detail = ref<OrgDetail | null>(idRef.value ? (cache.get(idRef.value) ?? null) : null)
  const loading = ref(false)
  const error = ref('')

  async function load() {
    if (!idRef.value) return
    // Only show the "Loading…" state when we have nothing to render. On tab
    // switches we already have cached data — refresh silently in background.
    if (!detail.value) loading.value = true
    error.value = ''
    try {
      const fresh = await getOrg(idRef.value)
      cache.set(idRef.value, fresh)
      detail.value = fresh
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load organization'
    } finally {
      loading.value = false
    }
  }

  const org = computed(() => detail.value?.data ?? null)
  const counts = computed(() => ({
    member: detail.value?.member_count ?? 0,
    project: detail.value?.project_count ?? 0,
    team: detail.value?.team_count ?? 0,
    invite: detail.value?.pending_invite_count ?? 0,
  }))

  onMounted(load)
  watch(idRef, (next, prev) => {
    if (next === prev) return
    detail.value = cache.get(next) ?? null
    load()
  })

  return { detail, org, counts, loading, error, reload: load }
}
