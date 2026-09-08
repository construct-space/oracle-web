import { createRouter, createWebHistory } from 'vue-router'
import { oracleSpaces } from './spaces'
import { useAuthStore } from './stores/auth'

const spaceRoutes = [
  ...oracleSpaces.flatMap((space) =>
    space.links.map((link) => ({
      path: link.path,
      name: `${space.id}:${link.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      component: space.dispatcher,
      meta: { spaceId: space.id },
    })),
  ),
  {
    path: '/accounts/users/:id',
    name: 'accounts:user-detail',
    component: oracleSpaces.find((s) => s.id === 'accounts')!.dispatcher,
    meta: { spaceId: 'accounts' },
  },
  {
    path: '/accounts/oauth-clients/:id',
    name: 'accounts:oauth-client-detail',
    component: oracleSpaces.find((s) => s.id === 'accounts')!.dispatcher,
    meta: { spaceId: 'accounts' },
  },
  {
    path: '/developer/publishers/:id',
    name: 'developer:publisher-detail',
    component: oracleSpaces.find((s) => s.id === 'developer')!.dispatcher,
    meta: { spaceId: 'developer' },
  },
  {
    path: '/developer/spaces/:id',
    name: 'developer:space-detail',
    component: oracleSpaces.find((s) => s.id === 'developer')!.dispatcher,
    meta: { spaceId: 'developer' },
  },
  {
    // Schema name can contain `__` separators and arbitrary identifier
    // characters. Vue-router's default `:name` segment forbids slashes only,
    // which is fine — graph schema names never contain `/`.
    path: '/developer/graph/:name',
    name: 'developer:schema-detail',
    component: oracleSpaces.find((s) => s.id === 'developer')!.dispatcher,
    meta: { spaceId: 'developer' },
  },

  // Source: nested org routes.
  {
    path: '/source/organizations/:id',
    name: 'source:org',
    component: oracleSpaces.find((s) => s.id === 'source')!.dispatcher,
    meta: { spaceId: 'source' },
  },
  {
    path: '/source/organizations/:id/members',
    name: 'source:org-members',
    component: oracleSpaces.find((s) => s.id === 'source')!.dispatcher,
    meta: { spaceId: 'source' },
  },
  {
    path: '/source/organizations/:id/projects',
    name: 'source:org-projects',
    component: oracleSpaces.find((s) => s.id === 'source')!.dispatcher,
    meta: { spaceId: 'source' },
  },
  {
    path: '/source/organizations/:id/teams',
    name: 'source:org-teams',
    component: oracleSpaces.find((s) => s.id === 'source')!.dispatcher,
    meta: { spaceId: 'source' },
  },
  {
    path: '/source/organizations/:id/invites',
    name: 'source:org-invites',
    component: oracleSpaces.find((s) => s.id === 'source')!.dispatcher,
    meta: { spaceId: 'source' },
  },

  // Source: provider catalog detail.
  {
    path: '/source/providers/:id',
    name: 'source:provider-detail',
    component: oracleSpaces.find((s) => s.id === 'source')!.dispatcher,
    meta: { spaceId: 'source' },
  },

  // Provider catalog detail (moved from source-api → provider-api 2026-05-11).
  {
    path: '/provider/providers/:id',
    name: 'provider:provider-detail',
    component: oracleSpaces.find((s) => s.id === 'provider')!.dispatcher,
    meta: { spaceId: 'provider' },
  },

  // Delivery: domain detail.
  {
    path: '/delivery/domains/:id',
    name: 'delivery:domain-detail',
    component: oracleSpaces.find((s) => s.id === 'delivery')!.dispatcher,
    meta: { spaceId: 'delivery' },
  },

  // Marketplace: collection edit page.
  {
    path: '/marketplace/collections/:id',
    name: 'marketplace:collection-edit',
    component: oracleSpaces.find((s) => s.id === 'marketplace')!.dispatcher,
    meta: { spaceId: 'marketplace' },
  },

  // Blog: post edit page.
  {
    path: '/blog/posts/:id',
    name: 'blog:post-edit',
    component: oracleSpaces.find((s) => s.id === 'blog')!.dispatcher,
    meta: { spaceId: 'blog' },
  },
]

const routes = [
  { path: '/login', name: 'login', component: () => import('./pages/LoginPage.vue'), meta: { public: true } },
  { path: '/', name: 'dashboard', component: () => import('./pages/DashboardPage.vue') },
  ...spaceRoutes,
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const auth = useAuthStore()
  if (!auth.checked) await auth.check()
  if (!auth.authenticated) return { name: 'login', query: { next: to.fullPath } }
  return true
})
