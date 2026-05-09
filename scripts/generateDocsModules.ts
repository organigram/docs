import fs from 'node:fs/promises'
import path from 'node:path'

const packageRoot = path.resolve(import.meta.dirname, '..')
const docsDir = path.resolve(packageRoot, 'mdx')
const outputFile = path.resolve(packageRoot, 'lib/modules.generated.ts')

const walk = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) return await walk(fullPath)
      return fullPath
    })
  )
  return files.flat()
}

const toDocPath = (fullPath: string): string =>
  `/${path.relative(docsDir, fullPath).split(path.sep).join('/')}`

const main = async (): Promise<void> => {
  const mdxFiles: string[] = (await walk(docsDir))
    .filter(filePath => filePath.endsWith('.mdx'))
    .map(toDocPath)
    .sort((a, b) => a.localeCompare(b))

  const importerEntries: string = mdxFiles
    .map(docPath => `  '${docPath}': async () => await import('../mdx${docPath}')`)
    .join(',\n')

  const generated = `/* eslint-disable */
// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Run: pnpm --filter docs generate:docs-modules

import { type ComponentType } from 'react'
import { type DocsMetadata } from '../types'

export type DocsModule = {
  default: ComponentType<Record<string, unknown>>
  metadata?: DocsMetadata
}

export type DocsImporter = () => Promise<DocsModule>

export const docsImporters: Record<string, DocsImporter> = {
${importerEntries}
}
`

  await fs.writeFile(outputFile, generated, 'utf8')
  console.info(
    `Generated ${path.relative(packageRoot, outputFile)} with ${mdxFiles.length} entries.`
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
