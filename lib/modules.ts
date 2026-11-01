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

/** The docs file served at `docPath`: the page itself, or its folder's index. */
export const resolveDocsPath = (docPath: string): string | null =>
  getPathCandidates(docPath).find(candidate => docsImporters[candidate] != null) ??
  null

export const getDocsImporter = (docPath: string): DocsImporter | null => {
  const resolved = resolveDocsPath(docPath)
  return resolved == null ? null : docsImporters[resolved]
}

export const getDocsModule = async (
  docPath: string
): Promise<DocsModule | null> => {
  const importer = getDocsImporter(docPath)
  return importer == null ? null : await importer()
}
