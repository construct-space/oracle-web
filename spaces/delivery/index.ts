import type { OracleSpace } from '../types'

const emailLinks = [
  {
    label: 'Overview',
    path: '/delivery/overview',
    description: 'Mail delivery overview and queue posture.',
    icon: 'mail-open',
  },
  {
    label: 'Messages',
    path: '/delivery/messages',
    description: 'Inspect recent outbound/inbound message activity.',
    icon: 'send',
  },
  { label: 'Domains', path: '/delivery/domains', description: 'Review verified sending domains.', icon: 'globe-2' },
  {
    label: 'Tenants',
    path: '/delivery/tenants',
    description: 'Per-user delivery footprint — who is sending, how much.',
    icon: 'users',
  },
  {
    label: 'API keys',
    path: '/delivery/api-keys',
    description: 'Manage delivery credentials and usage.',
    icon: 'key-square',
  },
] satisfies OracleSpace['links']

const notificationLinks = [
  {
    label: 'Notifications',
    path: '/delivery/notifications',
    description: 'Cross-user notification feed, push surface inventory, and a test composer.',
    icon: 'bell',
  },
] satisfies OracleSpace['links']

const space: OracleSpace = {
  id: 'delivery',
  title: 'Delivery',
  description: 'Email infrastructure operations, domains, and message activity.',
  icon: 'mail',
  apiBase: '/api/delivery',
  home: '/delivery/overview',
  dispatcher: () => import('./Dispatcher.vue'),
  // Flat link list for callers that don't render section headers
  // (search, breadcrumbs, etc.).
  links: [...emailLinks, ...notificationLinks],
  sections: [
    { label: 'Email', items: emailLinks },
    { label: 'Notifications', items: notificationLinks },
  ],
}

export default space
