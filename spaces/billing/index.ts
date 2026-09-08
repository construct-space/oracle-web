import type { OracleSpace } from '../types'

const links = [
  {
    label: 'Orders',
    path: '/billing/orders',
    description: 'Review recent orders and purchasing activity.',
    icon: 'receipt-text',
  },
  {
    label: 'Subscriptions',
    path: '/billing/subscriptions',
    description: 'Inspect active and past subscriptions.',
    icon: 'repeat',
  },
  { label: 'Credits', path: '/billing/credits', description: 'Track credit allocations and balances.', icon: 'coins' },
  { label: 'Plans', path: '/billing/plans', description: 'Manage available billing plans.', icon: 'badge-dollar-sign' },
] satisfies OracleSpace['links']

const space: OracleSpace = {
  id: 'billing',
  title: 'Billing',
  description: 'Revenue, subscriptions, credits, and plan management.',
  icon: 'credit-card',
  apiBase: '/api/billing',
  home: '/billing/orders',
  dispatcher: () => import('./Dispatcher.vue'),
  links,
  sections: [{ label: 'Revenue', items: links }],
}

export default space
