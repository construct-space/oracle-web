import type { OracleSpace } from '../types'

const links = [
  {
    label: 'Overview',
    path: '/domains/overview',
    description: 'Portfolio counts and expiring-soon heatmap.',
    icon: 'gauge',
  },
  {
    label: 'Domains',
    path: '/domains/list',
    description: 'Every registered domain across all tenants.',
    icon: 'globe-2',
  },
  { label: 'Redirects', path: '/domains/redirects', description: 'All configured URL forwardings.', icon: 'route' },
  {
    label: 'Tenants',
    path: '/domains/tenants',
    description: 'Per-user domain footprint + upcoming expiries.',
    icon: 'users',
  },
] satisfies OracleSpace['links']

const space: OracleSpace = {
  id: 'domains',
  title: 'Domains',
  description: 'Registrar operations, DNS, and URL forwarding across every tenant.',
  icon: 'globe-2',
  apiBase: '/api/domains',
  home: '/domains/overview',
  dispatcher: () => import('./Dispatcher.vue'),
  links,
  sections: [{ label: 'Operations', items: links }],
}

export default space
