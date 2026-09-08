import accounts from '@spaces/accounts'
import admin from '@spaces/admin'
// import billing from '@spaces/billing'  // hidden 2026-04-22 — backend is there but the ops UI is stubbed. Re-enable after the billing Phase D build.
import blog from '@spaces/blog'
import delivery from '@spaces/delivery'
import developer from '@spaces/developer'
import domains from '@spaces/domains'
import marketplace from '@spaces/marketplace'
import provider from '@spaces/provider'
import source from '@spaces/source'
import telemetry from '@spaces/telemetry'
import type { OracleSpace } from '@spaces/types'

// Graph lives under Developer — spaces use Graph as their backend runtime, so
// moderation of schemas/nodes belongs in the same operator surface as space
// moderation. See developer/index.ts for the link.
export const oracleSpaces: OracleSpace[] = [accounts, developer, marketplace, provider, delivery, source, domains, telemetry, blog, admin]

export function findSpace(id: string): OracleSpace | undefined {
  return oracleSpaces.find((space) => space.id === id)
}
