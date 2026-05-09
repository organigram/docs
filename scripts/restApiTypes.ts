export type ApiRouteSection =
  | 'Action routes'
  | 'Uploads and generated assets'
  | 'Authentication, billing, and integrations'

export type ApiActionDoc = { name: string; auth: string; description: string }

export interface ApiVisibleRouteDocs {
  hidden?: false
  section: ApiRouteSection
  summary: string
  auth: string
  description?: string
  notes?: string[]
  actions?: ApiActionDoc[]
}

export interface ApiHiddenRouteDocs {
  hidden: true
}

export type ApiRouteDocs = ApiHiddenRouteDocs | ApiVisibleRouteDocs
export type ApiOperationDoc = Partial<
  Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', ApiRouteDocs>
>
