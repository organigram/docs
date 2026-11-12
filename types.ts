export interface DocsMetadata {
  title: string
  description?: string
  order: number
  folderName?: string
}

export interface FileTree {
  text?: string
  path?: string
  children?: FileTree[]
  metadata?: DocsMetadata | null
}
