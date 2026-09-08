import type { OracleSpace } from '../types'

const links = [
  {
    label: 'Overview',
    path: '/telemetry/overview',
    description: 'Headline KPIs, active users, cost, top providers, error trend.',
    icon: 'gauge',
  },
  {
    label: 'Usage',
    path: '/telemetry/usage',
    description: 'Per-user, per-day sessions, minutes, tokens, errors.',
    icon: 'bar-chart-3',
  },
  {
    label: 'Devices',
    path: '/telemetry/devices',
    description: 'Device snapshots — OS, version, architecture.',
    icon: 'monitor-smartphone',
  },
  {
    label: 'Space usage',
    path: '/telemetry/space-usage',
    description: 'Which spaces each tenant touches.',
    icon: 'pie-chart',
  },
  {
    label: 'Model usage',
    path: '/telemetry/model-usage',
    description: 'Provider + model request volume, tokens, cost.',
    icon: 'brain-circuit',
  },
  {
    label: 'Performance',
    path: '/telemetry/perf',
    description: 'Latency histograms (min/max/avg) per metric.',
    icon: 'activity',
  },
  {
    label: 'Errors',
    path: '/telemetry/errors',
    description: 'Per-class error counts, ranked.',
    icon: 'triangle-alert',
  },
  {
    label: 'Tools',
    path: '/telemetry/tools',
    description: 'Builtin-tool invocation counts + success/error split.',
    icon: 'wrench',
  },
  {
    label: 'Geo',
    path: '/telemetry/geo',
    description: 'Active users by country, derived from sync IP.',
    icon: 'globe',
  },
] satisfies OracleSpace['links']

const space: OracleSpace = {
  id: 'telemetry',
  title: 'Telemetry',
  description: 'Device, model, usage, cost, and performance telemetry.',
  icon: 'activity',
  apiBase: '/api/telemetry',
  home: '/telemetry/overview',
  dispatcher: () => import('./Dispatcher.vue'),
  links,
  sections: [{ label: 'Insights', items: links }],
}

export default space
