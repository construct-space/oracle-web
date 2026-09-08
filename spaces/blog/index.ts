import type { OracleSpace } from '../types'

const links = [
  {
    label: 'Posts',
    path: '/blog/posts',
    description: 'Write, edit, and publish articles to lisaos.dev/blog.',
    icon: 'newspaper',
  },
] satisfies OracleSpace['links']

const space: OracleSpace = {
  id: 'blog',
  title: 'Blog',
  description: 'Author and publish posts to the public lisaos.dev/blog.',
  icon: 'pen-line',
  apiBase: '/api/blog',
  home: '/blog/posts',
  dispatcher: () => import('./Dispatcher.vue'),
  links,
  sections: [{ label: 'Content', items: links }],
}

export default space
