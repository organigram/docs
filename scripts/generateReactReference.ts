import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageDir = path.resolve(__dirname, '../../react')
const srcEntry = path.resolve(packageDir, 'src/index.ts')
const cacheTmpDir = path.resolve(packageDir, '.organigram-docs-cache/react/tmp')
const outputPath = path.resolve(
  __dirname,
  '../mdx/reference/react.mdx'
)

const categoryOrder = [
  'Components',
  'Hooks',
  'State',
  'Theme',
  'Utilities',
  'Types',
  'Namespaces',
  'Exports'
] as const

type Category = (typeof categoryOrder)[number]

interface ParamDoc {
  name: string
  description: string
}

interface FunctionDetails {
  params: ParamDoc[]
  returns: string
}

interface MemberInfo {
  name: string
  type: string
  description: string
}

interface ExportEntry {
  name: string
  kind: string
  anchorKind: string
  category: Category
  docs: string
  signature: string
  members: MemberInfo[]
  functionDetails: FunctionDetails | null
}

const kindLabels = {
  component: 'component',
  hook: 'hook',
  state: 'state',
  interface: 'interface',
  type: 'type',
  enum: 'enum',
  class: 'class',
  namespace: 'namespace',
  function: 'function',
  constant: 'constant'
} as const

const isKindLabel = (value: string): value is keyof typeof kindLabels =>
  value in kindLabels

const escapeMDX = (value: unknown): string =>
  String(value ?? '')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .trim()

const formatText = (value: unknown): string =>
  escapeMDX(String(value ?? '').replace(/\r\n/g, '\n'))
const formatTableText = (value: unknown): string =>
  formatText(value)
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()

const collapseInlineType = (value: unknown): string => {
  const normalized = String(value ?? '').replace(/\r\n/g, '\n').trim()

  if (!normalized.includes('\n')) {
    return normalized
  }

  const lines = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  if (normalized.startsWith('{') && normalized.endsWith('}')) {
    return lines
      .join('; ')
      .replace(/\{\s*;\s*/, '{ ')
      .replace(/;\s*\}$/, ' }')
  }

  return lines.join(' ')
}

const formatTableCode = (value: unknown): string =>
  collapseInlineType(value)
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '\\|')
    .replace(/`/g, '\\`')
    .trim()

const formatParagraph = (value?: string): string =>
  value != null && value !== '' ? `${formatText(value)}\n\n` : ''

const getTagText = (tag: ts.JSDocTagInfo): string =>
  Array.isArray(tag.text)
    ? tag.text.map(part => part.text ?? '').join('')
    : String(tag.text ?? '')

const parseParamTags = (tags: readonly ts.JSDocTagInfo[]): ParamDoc[] =>
  tags
    .filter(tag => tag.name === 'param')
    .map(tag => {
      const raw = getTagText(tag).trim()
      const match =
        raw.match(/^([\w$]+)\s*-\s*(.+)$/s) ??
        raw.match(/^([\w$]+)\s+(.+)$/s)
      return match == null
        ? null
        : {
            name: match[1],
            description: match[2].trim()
          }
    })
    .filter((param): param is ParamDoc => param != null)

const getReturnsTag = (tags: readonly ts.JSDocTagInfo[]): string => {
  const tag = tags.find(item => item.name === 'returns' || item.name === 'return')
  if (tag == null) return ''
  return getTagText(tag).trim()
}

const getKind = (declaration: ts.Declaration): string => {
  if (ts.isInterfaceDeclaration(declaration)) return 'interface'
  if (ts.isTypeAliasDeclaration(declaration)) return 'type'
  if (ts.isEnumDeclaration(declaration)) return 'enum'
  if (ts.isClassDeclaration(declaration)) return 'class'
  if (ts.isModuleDeclaration(declaration)) return 'namespace'
  if (ts.isFunctionDeclaration(declaration)) return 'function'
  if (ts.isVariableDeclaration(declaration)) return 'variable'
  return 'export'
}

const getCategory = ({
  name,
  kind,
  relativePath
}: {
  name: string
  kind: string
  relativePath: string
}): Category => {
  if (['interface', 'type', 'enum', 'class'].includes(kind)) return 'Types'
  if (name === 'procedures' || kind === 'namespace') return 'Namespaces'
  if (name.endsWith('State')) return 'State'
  if (relativePath.includes('/hooks/') || name.startsWith('use')) return 'Hooks'
  if (relativePath.includes('/theme/')) return 'Theme'
  if (relativePath.includes('/utils')) return 'Utilities'
  if (relativePath.includes('/components/')) return 'Components'
  return 'Exports'
}

const getAnchorKind = ({
  name,
  kind,
  relativePath
}: {
  name: string
  kind: string
  relativePath: string
}): string => {
  if (isKindLabel(kind)) {
    return kindLabels[kind]
  }
  if (name.endsWith('State')) return 'state'
  if (relativePath.includes('/hooks/') || name.startsWith('use')) return 'hook'
  if (relativePath.includes('/components/') && /^[A-Z]/.test(name)) {
    return 'component'
  }
  if (kind === 'variable') return 'constant'
  return isKindLabel(kind) ? kindLabels[kind] : 'export'
}

const getVariableSignature = (
  declaration: ts.VariableDeclaration,
  checker: ts.TypeChecker
): string => {
  const sourceFile = declaration.getSourceFile()
  const name = declaration.name.getText(sourceFile)

  if (declaration.type != null) {
    return `export const ${name}: ${declaration.type.getText(sourceFile)}`
  }

  const initializer = declaration.initializer
  if (initializer != null && ts.isLiteralExpression(initializer)) {
    return `export const ${name} = ${initializer.getText(sourceFile)}`
  }

  if (
    initializer != null &&
    (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
  ) {
    const type = checker.getTypeAtLocation(declaration)
    const typeString = checker.typeToString(
      type,
      declaration,
      ts.TypeFormatFlags.NoTruncation |
        ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
        ts.TypeFormatFlags.MultilineObjectLiterals
    )
    return `export const ${name}: ${typeString}`
  }

  if (initializer != null && ts.isObjectLiteralExpression(initializer)) {
    return `export const ${name} = ${initializer.getText(sourceFile)}`
  }

  const type = checker.getTypeAtLocation(declaration)
  const typeString = checker.typeToString(
    type,
    declaration,
    ts.TypeFormatFlags.NoTruncation |
      ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
      ts.TypeFormatFlags.MultilineObjectLiterals
  )
  return `export const ${name}: ${typeString}`
}

const getFunctionSignature = (declaration: ts.FunctionDeclaration): string => {
  const sourceFile = declaration.getSourceFile()
  const params = declaration.parameters
    .map(param => param.getText(sourceFile))
    .join(', ')
  const returnType =
    declaration.type != null ? `: ${declaration.type.getText(sourceFile)}` : ''
  return `export function ${declaration.name?.getText(sourceFile) ?? 'anonymous'}(${params})${returnType}`
}

const getClassSignature = (declaration: ts.ClassDeclaration): string => {
  const sourceFile = declaration.getSourceFile()
  const heritage =
    declaration.heritageClauses?.map(item => item.getText(sourceFile)).join(' ') ??
    ''
  return `export class ${declaration.name?.getText(sourceFile) ?? 'Anonymous'}${
    heritage !== '' ? ` ${heritage}` : ''
  }`
}

const getSignature = (
  declaration: ts.Declaration,
  checker: ts.TypeChecker
): string => {
  if (ts.isInterfaceDeclaration(declaration)) {
    return declaration.getText(declaration.getSourceFile())
  }
  if (ts.isTypeAliasDeclaration(declaration)) {
    return declaration.getText(declaration.getSourceFile())
  }
  if (ts.isEnumDeclaration(declaration)) {
    return declaration.getText(declaration.getSourceFile())
  }
  if (ts.isClassDeclaration(declaration)) {
    return getClassSignature(declaration)
  }
  if (ts.isFunctionDeclaration(declaration)) {
    return getFunctionSignature(declaration)
  }
  if (ts.isModuleDeclaration(declaration)) {
    return `export * as ${declaration.name.getText(
      declaration.getSourceFile()
    )} from './components/procedures'`
  }
  if (ts.isVariableDeclaration(declaration)) {
    return getVariableSignature(declaration, checker)
  }
  return declaration.getText(declaration.getSourceFile())
}

const getInterfaceMembers = (
  declaration: ts.InterfaceDeclaration | ts.ClassDeclaration,
  checker: ts.TypeChecker
): MemberInfo[] =>
  declaration.members
    .map(member => {
      if (
        !ts.isPropertySignature(member) &&
        !ts.isMethodSignature(member) &&
        !ts.isPropertyDeclaration(member) &&
        !ts.isMethodDeclaration(member)
      ) {
        return null
      }

      const name =
        member.name != null ? member.name.getText(declaration.getSourceFile()) : ''
      const symbol =
        member.name != null ? checker.getSymbolAtLocation(member.name) : undefined
      const description =
        symbol != null
          ? ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()
          : ''

      let type = 'unknown'
      if (
        ts.isPropertySignature(member) ||
        ts.isPropertyDeclaration(member) ||
        ts.isMethodSignature(member) ||
        ts.isMethodDeclaration(member)
      ) {
        if (member.type != null) {
          type = member.type.getText(declaration.getSourceFile())
        } else if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) {
          const signature = checker.getSignatureFromDeclaration(member)
          type =
            signature != null
              ? checker.signatureToString(signature, member)
              : member.getText(declaration.getSourceFile())
        }
      }

      return { name, type, description }
    })
    .filter((member): member is MemberInfo => member != null)

const getFunctionDetails = (
  declaration: ts.FunctionDeclaration | ts.VariableDeclaration,
  checker: ts.TypeChecker
): FunctionDetails | null => {
  const symbol =
    declaration.name != null ? checker.getSymbolAtLocation(declaration.name) : undefined
  const tags = symbol != null ? symbol.getJsDocTags(checker) : []
  const params = parseParamTags(tags)
  const returns = getReturnsTag(tags)

  if (params.length === 0 && returns === '') return null

  return { params, returns }
}

const renderSummaryList = (items: ExportEntry[]): string =>
  items
    .map(
      item =>
        `- [${item.name}](/docs/reference/react#${item.anchorKind}_${item.name})`
    )
    .join('\n')

const renderMembersTable = (members: MemberInfo[]): string => {
  if (members.length === 0) return ''

  const rows = members
    .map(
      member =>
        `| \`${member.name}\` | \`${formatTableCode(member.type)}\` | ${
          member.description !== '' ? formatTableText(member.description) : ' '
        } |`
    )
    .join('\n')

  return `**Members**

| Name | Type | Description |
| --- | --- | --- |
${rows}
`
}

const renderFunctionDocs = (details: FunctionDetails | null): string => {
  if (details == null) return ''

  const params =
    details.params.length > 0
      ? `**Parameters**

| Name | Description |
| --- | --- |
${details.params
  .map(
    param =>
      `| \`${param.name}\` | ${
        param.description !== '' ? formatTableText(param.description) : ' '
      } |`
  )
  .join('\n')}
`
      : ''

  const returns =
    details.returns !== ''
      ? `**Returns**

${formatText(details.returns)}
`
      : ''

  return `${params}${returns}`
}

const renderEntry = (entry: ExportEntry): string => `### ${entry.anchorKind} ++dnt++${entry.name}

${formatParagraph(entry.docs)}\`\`\`tsx
${entry.signature}
\`\`\`

${renderFunctionDocs(entry.functionDetails)}${renderMembersTable(entry.members)}
`

const buildProgram = (): ts.Program => {
  const configPath = ts.findConfigFile(packageDir, ts.sys.fileExists, 'tsconfig.json')
  if (configPath == null) {
    throw new Error('Unable to locate tsconfig.json for @organigram/react.')
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath)
  )

  return ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: { ...parsedConfig.options, noEmit: true }
  })
}

const collectExports = (): ExportEntry[] => {
  const program = buildProgram()
  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(srcEntry)

  if (sourceFile == null) {
    throw new Error('Unable to load packages/react/src/index.ts.')
  }

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile)
  if (moduleSymbol == null) {
    throw new Error('Unable to resolve exports from packages/react/src/index.ts.')
  }

  return checker
    .getExportsOfModule(moduleSymbol)
    .map(symbol => {
    const actualSymbol =
      symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    const declaration =
      actualSymbol
        .getDeclarations()
        ?.find(item => item.getSourceFile().fileName.includes(`${path.sep}src${path.sep}`)) ??
      actualSymbol.getDeclarations()?.[0]

    if (declaration == null) {
      return null
    }

    const kind = getKind(declaration)
    const docs = ts
      .displayPartsToString(actualSymbol.getDocumentationComment(checker))
      .trim()
    const relativePath = path
      .relative(packageDir, declaration.getSourceFile().fileName)
      .split(path.sep)
      .join('/')

    const anchorKind = getAnchorKind({
      name: symbol.getName(),
      kind,
      relativePath
    })

    return {
      name: symbol.getName(),
      kind,
      anchorKind,
      category: getCategory({
        name: symbol.getName(),
        kind,
        relativePath
      }),
      docs,
      signature: getSignature(declaration, checker),
      members:
        ts.isInterfaceDeclaration(declaration) || ts.isClassDeclaration(declaration)
          ? getInterfaceMembers(declaration, checker)
          : [],
      functionDetails:
        ts.isFunctionDeclaration(declaration) || ts.isVariableDeclaration(declaration)
          ? getFunctionDetails(declaration, checker)
          : null
    }
    })
    .filter((entry): entry is ExportEntry => entry != null)
}

const buildDocument = (entries: ExportEntry[]): string => {
  const grouped = Object.fromEntries(
    categoryOrder.map(category => [
      category,
      entries
        .filter(entry => entry.category === category)
        .sort((a, b) => a.name.localeCompare(b.name))
    ])
  ) as Record<Category, ExportEntry[]>

  const summarySections = categoryOrder
    .filter(category => grouped[category].length > 0)
    .map(
      category => `### ${category}

${renderSummaryList(grouped[category])}
`
    )
    .join('\n')

  const detailSections = categoryOrder
    .filter(category => grouped[category].length > 0)
    .map(
      category => `## ${category}

${grouped[category].map(renderEntry).join('\n')}`
    )
    .join('\n\n')

  return `export const metadata = { title: "⚛️ React", order: 5.3 }

# React reference ⚛️

The official React documentation for the hooks, components, theme helpers, and utilities exposed by the Organigram.ai stack.

## @organigram/react

### Install

\`\`\`bash
pnpm add @organigram/react
\`\`\`

### Quick start

\`\`\`tsx
import { Diagram, useOrganigramClient } from '@organigram/react'
\`\`\`

### Exports

${summarySections}

${detailSections}
`
}

await fs.mkdir(cacheTmpDir, { recursive: true })

const entries = collectExports()
const document = buildDocument(entries)

await fs.writeFile(outputPath, document, 'utf8')
console.info(`Generated ${path.relative(packageDir, outputPath)}.`)
