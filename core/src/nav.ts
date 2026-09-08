import { oracleSpaces } from './spaces'

export interface OracleNavItem {
  label: string
  to: string
  description: string
}

export interface OracleSection {
  id: string
  title: string
  description: string
  items: OracleNavItem[]
}

export const sections: OracleSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    description: 'Staff dashboard and high-level platform status.',
    items: [{ label: 'Dashboard', to: '/', description: 'System summary, quick links, and operational context.' }],
  },
  ...oracleSpaces.map((space) => ({
    id: space.id,
    title: space.title,
    description: space.description,
    items: space.links.map((link) => ({
      label: link.label,
      to: link.path,
      description: link.description,
    })),
  })),
]

export const flatNav = sections.flatMap((section) => section.items)
