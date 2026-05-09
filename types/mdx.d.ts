declare module '*.mdx' {
  import { type ComponentType } from 'react'
  import { type DocsMetadata } from '../types'

  const MDXComponent: ComponentType<Record<string, unknown>>
  export default MDXComponent
  export const metadata: DocsMetadata | undefined
}
