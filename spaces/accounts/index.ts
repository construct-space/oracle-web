import type { OracleSpace } from '../types'

const links = [
  { label: 'Users', path: '/accounts/users', description: 'Search and inspect Construct accounts.', icon: 'users' },
  {
    label: 'Sessions',
    path: '/accounts/sessions',
    description: 'Review and revoke active sessions.',
    icon: 'key-round',
  },
  {
    label: 'OAuth clients',
    path: '/accounts/oauth-clients',
    description: 'Manage client registrations and grants.',
    icon: 'shield',
  },
] satisfies OracleSpace['links']

const space: OracleSpace = {
  id: 'accounts',
  title: 'Accounts',
  description: 'User, session, token, and account moderation flows.',
  icon: 'users',
  apiBase: '/api/accounts',
  home: '/accounts/users',
  dispatcher: () => import('./Dispatcher.vue'),
  links,
  sections: [{ label: 'Account operations', items: links }],
}

export default space
