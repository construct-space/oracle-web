import type { OracleSpace } from '../types'

const orgLinks = [
  {
    label: 'Organizations',
    path: '/source/organizations',
    description: 'Inspect organizations, members, projects, teams, and invites.',
    icon: 'building-2',
  },
] satisfies OracleSpace['links']

const widgetLinks = [
  {
    label: 'Feed',
    path: '/source/feed',
    description: 'Content blocks on the construct-app home page top strip.',
    icon: 'layout-dashboard',
  },
] satisfies OracleSpace['links']

const space: OracleSpace = {
  id: 'source',
  title: 'Source',
  description: 'Organizations, projects, teams, and collaboration operations.',
  icon: 'building',
  apiBase: '/api/source',
  home: '/source/organizations',
  dispatcher: () => import('./Dispatcher.vue'),
  links: [...orgLinks, ...widgetLinks],
  sections: [
    { label: 'Organization', items: orgLinks },
    { label: 'Widgets', items: widgetLinks },
  ],
}

export default space
