import type { OracleSpace } from '../types'

const links = [
  {
    label: 'Administrators',
    path: '/admin/administrators',
    description: 'Manage Oracle staff accounts.',
    icon: 'shield-check',
  },
  {
    label: 'Audit log',
    path: '/admin/audit-log',
    description: 'Track every privileged action taken through Oracle.',
    icon: 'scroll-text',
  },
] satisfies OracleSpace['links']

const space: OracleSpace = {
  id: 'admin',
  title: 'Admin',
  description: 'Oracle administrators and audit control.',
  icon: 'shield',
  apiBase: '/api/admin',
  home: '/admin/administrators',
  dispatcher: () => import('./Dispatcher.vue'),
  links,
  sections: [{ label: 'Staff control', items: links }],
}

export default space
