import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

type RenderMode = 'text' | 'code'

interface DocReturnInfo {
  type?: string
  description?: string
}

interface DocSyntax {
  content?: string
  parameters?: DocParameter[]
  return?: DocReturnInfo
}

interface DocParameter {
  id?: string
  name?: string
  type?: string
  description?: string
  syntax?: DocSyntax
}

interface DocMember {
  name: string
  summary?: string
  remarks?: string
  example?: string[]
  syntax?: DocSyntax
}

interface DocField {
  name: string
  value?: string
  summary?: string
}

interface DocDeclaration {
  uid?: string
  type?: string
  name: string
  summary?: string
  remarks?: string
  example?: string[]
  syntax?: string
  extends?: string
  constructors?: DocMember[]
  properties?: DocMember[]
  methods?: DocMember[]
  fields?: DocField[]
  classes?: string[]
  interfaces?: string[]
  typeAliases?: string[]
  enums?: string[]
  functions?: DocMember[]
}

interface YamlModule {
  load(input: string): unknown
}

/** An item of the api-extractor model, which also lists constants and source files. */
interface ApiModelItem {
  kind: string
  name: string
  docComment?: string
  fileUrlPath?: string
  excerptTokens?: Array<{ text: string }>
  members?: ApiModelItem[]
}

/** A section of the reference page, read from the package `reference.json`. */
interface ReferenceSection {
  title: string
  /** Hand-written paragraph introducing the section, in Markdown. */
  intro?: string
  /** Source modules whose exports belong here; `ipfs/` matches a folder. */
  files?: string[]
  /** Exports that belong here whatever their module. */
  names?: string[]
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const requestedPackageDir = process.argv[2]
const packageDir =
  requestedPackageDir == null
    ? path.resolve(__dirname, '..')
    : path.resolve(process.cwd(), requestedPackageDir)
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(packageDir, 'package.json'), 'utf8')
) as { name: string }
const packageName = packageJson.name
const docsSlug = process.argv[3] ?? packageName.replace(/^@organigram\//, '')
const docsBasePath = `/docs/reference/${docsSlug}`
const yamlInputDir =
  process.argv[4] == null
    ? path.resolve(packageDir, 'yaml')
    : path.resolve(packageDir, process.argv[4])
const pnpmRoot = path.resolve(__dirname, '../../../node_modules/.pnpm')
const yamlPackageDir = fs
  .readdirSync(pnpmRoot)
  .filter(entry => entry.startsWith('js-yaml@'))
  .sort()
  .at(-1)

if (yamlPackageDir == null) {
  throw new Error('Unable to locate js-yaml in the pnpm store.')
}

const yamlModule = (await import(
  pathToFileURL(
    path.join(pnpmRoot, yamlPackageDir, 'node_modules/js-yaml/index.js')
  ).href
)) as { default: YamlModule }
const yaml = yamlModule.default

const docsOutputPath = path.resolve(
  __dirname,
  `../mdx/reference/${docsSlug}.mdx`
)
const referenceConfigBySlug: Record<string, { title: string; order: number }> =
  {
    js: { title: 'JavaScript/TypeScript', order: 5.2 },
    react: { title: 'React', order: 5.3 },
    'passkey-wallet': { title: 'Passkey Wallet', order: 5.4 },
    agent: { title: 'Agent', order: 5.5 }
  }

const referenceConfig = referenceConfigBySlug[docsSlug] ?? {
  title: packageName,
  order: 5.9
}

// The package README introduces the page, so it must stay valid MDX.
const readmePath = path.resolve(packageDir, 'README.md')
const introduction = fs.existsSync(readmePath)
  ? fs.readFileSync(readmePath, 'utf8').trim()
  : `# ${packageName}`

// The api-extractor model gives the source module of each export, and the
// constants that api-documenter leaves out of its YAML files.
const apiModelPath = path.resolve(
  yamlInputDir,
  '..',
  'api-model',
  `${docsSlug}.api.json`
)
const entryPoint = fs.existsSync(apiModelPath)
  ? ((JSON.parse(fs.readFileSync(apiModelPath, 'utf8')) as ApiModelItem)
      .members?.[0]?.members ?? [])
  : []
const sourceFileByName = new Map(
  entryPoint.map(item => [
    item.name,
    (item.fileUrlPath ?? '').replace(/^dist\//, '').replace(/\.d\.ts$/, '')
  ])
)
const constants = entryPoint.filter(item => item.kind === 'Variable')

// Sections group exports by topic, each with a hand-written introduction.
const sectionsPath = path.resolve(packageDir, 'reference.json')
const sections: ReferenceSection[] = fs.existsSync(sectionsPath)
  ? (JSON.parse(fs.readFileSync(sectionsPath, 'utf8')) as ReferenceSection[])
  : [{ title: 'API reference' }]

const decodeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

const escapeMDX = (value: unknown): string =>
  String(value ?? '')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .trim()

// api-extractor renames exports that shadow a global, such as `File`, to `File_2`.
const exportName = (name: string): string => name.replace(/_\d+$/, '')

const getUidDisplayName = (uid: string): string => {
  const [, objectName = uid] = uid.split('!')
  const [object] = objectName.split(':')
  const [parent, name] = object.split('#')
  return exportName(name ?? parent)
}

// Same as `slugify` in lib/mdx.tsx, which sets the ids of the headings.
const getUidAnchor = (uid: string): string => {
  const [, objectName = uid] = uid.split('!')
  const [object] = objectName.split(':')
  return exportName(object)
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
}

const renderUidReference = (
  uid: string,
  mode: RenderMode = 'text',
  label?: string
): string => {
  const displayName = String(label ?? getUidDisplayName(uid)).trim()

  if (mode === 'code') {
    return displayName
  }

  if (!uid.startsWith(`${packageName}!`)) {
    return `\`${displayName}\``
  }

  return `[${displayName}](${docsBasePath}#${getUidAnchor(uid)})`
}

const replaceXrefs = (value: unknown, mode: RenderMode = 'text'): string =>
  decodeHtml(value)
    .replace(/<!--\s*-->/g, '')
    .replace(/\[([^\]]+)\]\(xref:([^)]+)\)/g, (_match, label, uid) =>
      renderUidReference(uid, mode, label)
    )
    .replace(/<xref uid="([^"]+)" \/>/g, (_match, uid) =>
      renderUidReference(uid, mode)
    )

const formatText = (value: unknown): string =>
  escapeMDX(replaceXrefs(value, 'text'))
const formatCode = (value: unknown): string =>
  replaceXrefs(value, 'code').trim()
const formatTableText = (value: unknown): string =>
  formatText(value)
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()
const formatTableCode = (value: unknown): string =>
  formatCode(value)
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()
// A code span holding backticks needs a longer delimiter: backslashes do not
// escape them in code.
const renderTableCode = (value: unknown): string => {
  const code = formatTableCode(value)
  return code.includes('`') ? `\`\` ${code} \`\`` : `\`${code}\``
}

const renderParagraph = (value?: string): string =>
  value != null && value !== '' ? `${formatText(value)}\n\n` : ''

const renderExamples = (examples?: string[]): string =>
  (examples ?? []).map(example => `${decodeHtml(example).trim()}\n\n`).join('')

const renderCodeBlock = (content?: string): string =>
  content != null && content !== ''
    ? `\`\`\`typescript
${formatCode(content)}
\`\`\`

`
    : ''

/** Fold signatures and parameter tables, so that the page reads as explanations first. */
const renderDetails = (label: string, content: string): string =>
  content.trim() === ''
    ? ''
    : `<details>
<summary>${label}</summary>

${content.trim()}

</details>

`

const missingSummaries: string[] = []

const hasText = (value?: string): value is string =>
  value != null && value.trim() !== ''

/** The one-sentence summary of an export, which the table of contents also shows. */
const renderSummary = (name: string, summary?: string): string => {
  if (!hasText(summary)) {
    missingSummaries.push(name)
    return ''
  }
  return `<div data-summary>

${formatText(summary)}

</div>

`
}

const renderMemberText = (name: string, member: DocMember): string => {
  if (!hasText(member.summary)) missingSummaries.push(name)
  return `${renderParagraph(member.summary)}${renderParagraph(member.remarks)}${renderExamples(member.example)}`
}

const shouldRenderItemsTable = (items?: DocParameter[]): boolean =>
  items != null &&
  items.length > 0 &&
  items.some(item => item.description != null && item.description !== '')

const renderItemsTable = (title: string, items?: DocParameter[]): string => {
  if (!shouldRenderItemsTable(items)) return ''
  // api-documenter also lists a destructured parameter under its pattern, with
  // neither type nor description, next to the documented parameter.
  const resolvedItems = (items ?? []).filter(
    item => hasText(item.type) || hasText(item.description)
  )

  const rows = resolvedItems
    .map((item, index) => {
      const name = `\`${item.id ?? item.name ?? `value${index}`}\``
      const type = renderTableCode(item.type ?? item.syntax?.return?.type ?? 'unknown')
      const description =
        item.description != null && item.description !== ''
          ? formatTableText(item.description)
          : ' '
      return `| ${name} | ${type} | ${description} |`
    })
    .join('\n')

  return `**${title}**

| Name | Type | Description |
| --- | --- | --- |
${rows}

`
}

const renderReturnTable = (syntax?: DocSyntax): string => {
  if (!hasText(syntax?.return?.description)) return ''
  return `**Returns**

| Type | Description |
| --- | --- |
| ${renderTableCode(syntax?.return?.type)} | ${formatTableText(syntax?.return?.description)} |

`
}

const renderSignature = (syntax?: DocSyntax): string =>
  renderDetails(
    'Signature',
    `${renderCodeBlock(syntax?.content)}${renderItemsTable(
      'Parameters',
      syntax?.parameters
    )}${renderReturnTable(syntax)}`
  )

const memberName = (member: DocMember): string => member.name.split('(')[0]

/** Arrow-function properties read like methods, so they are rendered as such. */
const isFunctionProperty = (member: DocMember): boolean =>
  /^(?:static |readonly )*[\w$]+\??:\s*(?:<[^>]*>\s*)?\(/.test(
    member.syntax?.content ?? ''
  )

const renderMethod = (method: DocMember, ownerName: string): string => {
  const name = `${ownerName}.${memberName(method)}`
  return `#### ++dnt++${name}

${renderMemberText(name, method)}${renderSignature(method.syntax)}`
}

const propertyType = (property: DocMember): string =>
  (property.syntax?.content ?? '')
    .replace(/^(?:static |readonly )*[\w$]+\??:\s*/, '')
    .replace(/;$/, '')

const renderPropertiesTable = (
  properties: DocMember[],
  ownerName: string
): string =>
  properties.length === 0
    ? ''
    : `| Property | Type | Description |
| --- | --- | --- |
${properties
  .map(property => {
    if (!hasText(property.summary)) {
      missingSummaries.push(`${ownerName}.${memberName(property)}`)
    }
    return `| \`${memberName(property)}\` | ${renderTableCode(propertyType(property))} | ${formatTableText(property.summary)} |`
  })
  .join('\n')}

`

const renderHeader = (declaration: DocDeclaration): string =>
  `### ++dnt++${exportName(declaration.name)}

${renderSummary(declaration.name, declaration.summary)}${renderParagraph(
    declaration.remarks
  )}${renderExamples(declaration.example)}`

const renderMembers = (declaration: DocDeclaration): string => {
  const properties = (declaration.properties ?? []).filter(
    property => !isFunctionProperty(property)
  )
  const methods = [
    ...(declaration.properties ?? []).filter(isFunctionProperty),
    ...(declaration.methods ?? [])
  ].sort((a, b) => memberName(a).localeCompare(memberName(b)))
  return `${renderPropertiesTable(properties, declaration.name)}${methods
    .map(method => renderMethod(method, declaration.name))
    .join('')}`
}

const renderClass = (declaration: DocDeclaration): string =>
  `${renderHeader(declaration)}${renderDetails(
    'Definition',
    `${renderCodeBlock(declaration.syntax)}${(declaration.constructors ?? [])
      .map(
        constructor =>
          `${renderCodeBlock(constructor.syntax?.content)}${renderItemsTable(
            'Constructor parameters',
            constructor.syntax?.parameters
          )}`
      )
      .join('')}`
  )}${renderMembers(declaration)}`

const renderInterface = (declaration: DocDeclaration): string =>
  `${renderHeader(declaration)}${
    hasText(declaration.extends)
      ? `Extends ${formatText(declaration.extends)}.\n\n`
      : ''
  }${renderMembers(declaration)}`

const renderType = (declaration: DocDeclaration): string =>
  `${renderHeader(declaration)}${renderDetails(
    'Definition',
    renderCodeBlock(declaration.syntax)
  )}`

const renderEnum = (declaration: DocDeclaration): string => {
  const fields = declaration.fields ?? []
  return `${renderHeader(declaration)}${
    fields.length > 0
      ? `| Name | Value | Description |
| --- | --- | --- |
${fields
  .map(
    field =>
      `| \`${field.name}\` | ${renderTableCode(field.value)} | ${formatTableText(field.summary)} |`
  )
  .join('\n')}

`
      : ''
  }`
}

const renderFunction = (func: DocMember): string =>
  `${renderHeader({ ...func, name: memberName(func), syntax: undefined })}${renderSignature(func.syntax)}`

/** Read the summary, remarks and examples of a raw TSDoc comment. */
const parseDocComment = (
  comment = ''
): Pick<DocMember, 'summary' | 'remarks' | 'example'> => {
  const text = comment
    .replace(/^\s*\/\*\*/, '')
    .replace(/\*\/\s*$/, '')
    .split('\n')
    .map(line => line.replace(/^\s*\* ?/, ''))
    .join('\n')
  const [summary, ...blocks] = text.split(/^(?=@\w+)/m)
  const block = (tag: string): string[] =>
    blocks
      .filter(text => text.startsWith(tag))
      .map(text => text.slice(tag.length).trim())
  return {
    summary: summary.trim(),
    remarks: block('@remarks').join('\n\n'),
    example: block('@example')
  }
}

// Long constant types, such as the templates, would bury the explanation.
const maxConstantSignatureLength = 400

const renderConstant = (item: ApiModelItem): string => {
  const signature = `const ${(item.excerptTokens ?? [])
    .map(token => token.text)
    .join('')
    .replace(/^export declare const /, '')
    .trim()}`
  return `${renderHeader({ name: item.name, ...parseDocComment(item.docComment) })}${
    signature.length <= maxConstantSignatureLength
      ? renderDetails('Definition', renderCodeBlock(signature))
      : ''
  }`
}

type ReferenceItem = {
  name: string
  kindOrder: number
  render: () => string
}

const renderDeclaration = (declaration: DocDeclaration): ReferenceItem | null => {
  const kind = declaration.uid?.split(':')?.[1]
  const renderers: Record<string, [number, (item: DocDeclaration) => string]> = {
    class: [0, renderClass],
    interface: [1, renderInterface],
    type: [2, renderType],
    enum: [3, renderEnum]
  }
  const renderer = kind == null ? undefined : renderers[kind]
  if (renderer == null) return null
  return {
    name: declaration.name,
    kindOrder: renderer[0],
    render: () => renderer[1](declaration)
  }
}

const findSection = (name: string): number => {
  const byName = sections.findIndex(section =>
    section.names?.includes(exportName(name))
  )
  if (byName >= 0) return byName
  const file = sourceFileByName.get(name) ?? ''
  const byFile = sections.findIndex(
    section =>
      (section.files == null && section.names == null) ||
      section.files?.some(entry =>
        entry.endsWith('/') ? file.startsWith(entry) : file === entry
      )
  )
  return byFile >= 0 ? byFile : sections.length
}

const fileOrder = (name: string, section?: ReferenceSection): number => {
  const file = sourceFileByName.get(name) ?? ''
  const index = (section?.files ?? []).findIndex(entry =>
    entry.endsWith('/') ? file.startsWith(entry) : file === entry
  )
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER
}

const renderSections = (items: ReferenceItem[]): string => {
  const allSections = [...sections, { title: 'Other' }]
  const grouped = allSections.map(() => [] as ReferenceItem[])
  items.forEach(item => grouped[findSection(item.name)].push(item))
  return allSections
    .map((section, index) => {
      const sectionItems = grouped[index].sort(
        (a, b) =>
          fileOrder(a.name, section) - fileOrder(b.name, section) ||
          a.kindOrder - b.kindOrder ||
          a.name.localeCompare(b.name)
      )
      if (sectionItems.length === 0) return ''
      return `## ${section.title}

${section.intro != null ? `${section.intro.trim()}\n\n` : ''}${sectionItems
        .map(item => item.render())
        .join('')}`
    })
    .join('')
}

// React components are values named in PascalCase: they lead, like classes.
const valueKindOrder = (name: string, order: number): number =>
  /^[A-Z][a-z]/.test(name) ? 0 : order

const markdown = async ({
  files
}: {
  files: DocDeclaration[]
}): Promise<void> => {
  const packageDeclaration = files.find(file => file.type === 'package')
  const items = [
    ...files.map(renderDeclaration),
    ...(packageDeclaration?.functions ?? []).map(func => ({
      name: memberName(func),
      kindOrder: valueKindOrder(memberName(func), 4),
      render: () => renderFunction(func)
    })),
    ...constants.map(constant => ({
      name: constant.name,
      kindOrder: valueKindOrder(constant.name, 5),
      render: () => renderConstant(constant)
    }))
  ].filter((item): item is ReferenceItem => item != null)

  const content = `export const metadata = { title: "${referenceConfig.title}", order: ${referenceConfig.order} }

${introduction}

${renderSections(items)}`
  await fs.promises.writeFile(docsOutputPath, content, 'utf8')

  if (missingSummaries.length > 0) {
    console.warn(
      `${missingSummaries.length} public exports or members have no summary:\n  ${missingSummaries.join('\n  ')}`
    )
  }
}

const walkPath = (dir: string): string[] => {
  let results: string[] = []
  const list = fs.readdirSync(dir)
  list.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat?.isDirectory()) {
      results = results.concat(walkPath(filePath))
    } else {
      results.push(filePath)
    }
  })

  return results
}

async function build() {
  const filePaths = walkPath(yamlInputDir)
    .filter(filePath => filePath.endsWith('.yml'))
    .filter(filePath => !filePath.endsWith(`${path.sep}toc.yml`))
    .sort()
  const files = filePaths.map(
    filePath => yaml.load(fs.readFileSync(filePath, 'utf8')) as DocDeclaration
  )
  await markdown({ files })
  console.info('done!')
}

await build()
