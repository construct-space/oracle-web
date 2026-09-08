export interface OracleSpaceLink {
  label: string
  path: string
  description: string
  icon: string
}

export interface OracleSpaceSection {
  label: string
  items: OracleSpaceLink[]
}

export interface OracleSpace {
  id: string
  title: string
  description: string
  icon: string
  apiBase: string
  home: string
  links: OracleSpaceLink[]
  sections: OracleSpaceSection[]
  dispatcher: () => Promise<unknown>
}
