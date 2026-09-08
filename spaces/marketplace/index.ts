import type { OracleSpace } from '../types'

const links = [
  {
    label: 'Spaces',
    path: '/marketplace/spaces',
    description: 'Catalog rows — assign category, tags, editorial.',
    icon: 'blocks',
  },
  {
    label: 'Categories',
    path: '/marketplace/categories',
    description: 'Top-level taxonomy (Productivity, Health, Finance…).',
    icon: 'list-tree',
  },
  {
    label: 'Collections',
    path: '/marketplace/collections',
    description: 'Staff Picks, Trending, time-boxed features.',
    icon: 'star',
  },
] satisfies OracleSpace['links']

const space: OracleSpace = {
  id: 'marketplace',
  title: 'Marketplace',
  description: 'Curate the catalog: categories, tags, collections, editorial.',
  icon: 'shopping-bag',
  apiBase: '/api/marketplace',
  home: '/marketplace/spaces',
  dispatcher: () => import('./Dispatcher.vue'),
  links,
  sections: [
    { label: 'Catalog', items: links.slice(0, 1) },
    { label: 'Curation', items: links.slice(1) },
  ],
}

export default space
