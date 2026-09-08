import type { OracleSpace } from '../types'

const links = [
  {
    label: 'Publishers',
    path: '/developer/publishers',
    description: 'Review publisher identity and verification.',
    icon: 'package-open',
  },
  {
    label: 'Pending spaces',
    path: '/developer/pending-spaces',
    description: 'Moderate submitted spaces.',
    icon: 'inbox',
  },
  { label: 'All spaces', path: '/developer/spaces', description: 'Every space on the marketplace.', icon: 'blocks' },
  {
    label: 'Graph',
    path: '/developer/graph',
    description: 'Graph runtime, schemas, and node health.',
    icon: 'database',
  },
] satisfies OracleSpace['links']

const space: OracleSpace = {
  id: 'developer',
  title: 'Developer',
  description: 'Publisher review and space moderation.',
  icon: 'code-xml',
  apiBase: '/api/developer',
  home: '/developer/publishers',
  dispatcher: () => import('./Dispatcher.vue'),
  links,
  sections: [
    { label: 'Moderation', items: links.slice(0, 3) },
    { label: 'Runtime', items: links.slice(3) },
  ],
}

export default space
