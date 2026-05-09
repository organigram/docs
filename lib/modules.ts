import {
  docsImporters,
  type DocsImporter,
  type DocsModule
} from './modules.generated'

const withSuffix = (docPath: string): string =>
  docPath.endsWith('.mdx') ? docPath : `${docPath}.mdx`

const trimTrailingSlash = (docPath: string): string =>
  docPath.length > 1 && docPath.endsWith('/') ? docPath.slice(0, -1) : docPath

const getPathCandidates = (docPath: string): string[] => {
  const normalized = withSuffix(trimTrailingSlash(docPath))
  if (normalized.endsWith('/index.mdx')) return [normalized]
  const withoutSuffix = normalized.replace(/\.mdx$/, '')
  return [normalized, `${withoutSuffix}/index.mdx`]
}

export const getDocsImporter = (docPath: string): DocsImporter | null => {
  for (const candidate of getPathCandidates(docPath)) {
    const importer = docsImporters[candidate]
    if (importer != null) return importer
  }
  return null
}

export const getDocsModule = async (
  docPath: string
): Promise<DocsModule | null> => {
  const importer = getDocsImporter(docPath)
  return importer == null ? null : await importer()
}
