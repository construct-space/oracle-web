import type { OracleSpace } from '../types'

const catalogLinks = [
  {
    label: 'Providers',
    path: '/provider/providers',
    description: 'AI provider catalog served to every Construct client (BYOK).',
    icon: 'cpu',
  },
] satisfies OracleSpace['links']

const constructLinks = [
  {
    label: 'Picker Entries',
    path: '/provider/construct/picker-entries',
    description: 'User-facing chat models shown in the desktop picker. Today: "source".',
    icon: 'sparkles',
  },
  {
    label: 'Routing Targets',
    path: '/provider/construct/routing-targets',
    description: 'Internal aliases (Apoc, Trinity, …) bound to one upstream + model id. Referenced by Source Family routing.',
    icon: 'route',
  },
  {
    label: 'Upstream Keys',
    path: '/provider/construct/upstreams',
    description: 'API keys for the real upstreams (Together, Fireworks, OpenRouter, …) that routing targets resolve to.',
    icon: 'key',
  },
  {
    label: 'Source Family',
    path: '/provider/source-family',
    description: 'Per-operator (Tank / Trinity / Apoc / Mouse / Oracle / Neo / Morpheus) → routing-target chain.',
    icon: 'split',
  },
  {
    label: 'Credit Settings',
    path: '/provider/construct/config',
    description: 'Daily allowance, kill switch, top users.',
    icon: 'sliders-horizontal',
  },
] satisfies OracleSpace['links']

const space: OracleSpace = {
  id: 'provider',
  title: 'Providers',
  description: 'AI provider catalog, managed Construct models, upstream keys, and credits.',
  icon: 'cpu',
  apiBase: '/api/provider',
  home: '/provider/providers',
  dispatcher: () => import('./Dispatcher.vue'),
  links: [...catalogLinks, ...constructLinks],
  sections: [
    { label: 'Catalog', items: catalogLinks },
    { label: 'Construct', items: constructLinks },
  ],
}

export default space
