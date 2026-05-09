export type ApiRouteSection =
  | 'Action routes'
  | 'Uploads and generated assets'
  | 'Authentication, billing, and integrations'

export type ApiActionDoc =
  | string
  | {
      auth?: string
      description: string
    }

export interface ApiOperationDoc {
  name: string
  trigger?: string
  auth?: string
  description: string
}

export interface ApiVisibleRouteDocs {
  hidden?: boolean
  section: ApiRouteSection
  order: number
  summary: string
  methods: string[]
  auth: string
  body: string
  notes?: string[]
  actions?: Record<string, ApiActionDoc>
  operations?: ApiOperationDoc[]
}

export interface ApiHiddenRouteDocs {
  hidden: true
}

export type ApiRouteDocs = ApiHiddenRouteDocs | ApiVisibleRouteDocs
