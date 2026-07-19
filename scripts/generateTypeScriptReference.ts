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
const companyUrl = process.env.NEXT_PUBLIC_COMPANY_URL ?? 'Organigram.ai'

const referenceConfigBySlug: Record<
  string,
  {
    title: string
    order: number
    heading: string
    description: string
    quickStartTitle: string
    quickStartLanguage: string
    quickStartImport: string
  }
> = {
  js: {
    title: '⚙️ Typescript',
    order: 5.2,
    heading: 'Typescript reference ⚙️',
    description: `The official Javascript/Typescript documentation for the contracts and types used in the ${companyUrl} stack.`,
    quickStartTitle: 'Init',
    quickStartLanguage: 'ts',
    quickStartImport: `import { OrganigramClient } from '${packageName}'`
  },
  'passkey-wallet': {
    title: '🫆 Passkey Wallet',
    order: 5.4,
    heading: 'Passkey Wallet reference 🫆',
    description:
      'The official TypeScript documentation for the Organigram Passkey Wallet primitives.',
    quickStartTitle: 'Quick start',
    quickStartLanguage: 'ts',
    quickStartImport: `import { buildPasskeyWalletCapabilities } from '${packageName}'`
  },
  agent: {
    title: '🤖 Agent',
    order: 5.5,
    heading: 'Agent reference 🤖',
    description:
      'The official TypeScript documentation for the Organigram workspace agent primitives.',
    quickStartTitle: 'Quick start',
    quickStartLanguage: 'ts',
    quickStartImport: `import { buildPrompt, normalizeResponse } from '${packageName}'`
  }
}

const referenceConfig =
  referenceConfigBySlug[docsSlug] ?? {
    title: packageName,
    order: 5.9,
    heading: `${packageName} reference`,
    description: `The official TypeScript documentation for ${packageName}.`,
    quickStartTitle: 'Quick start',
    quickStartLanguage: 'ts',
    quickStartImport: `import { } from '${packageName}'`
  }

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

const getUidDisplayName = (uid: string): string => {
  const [, objectName = uid] = uid.split('!')
  const [object] = objectName.split(':')
  const [parent, name] = object.split('#')
  return name ?? parent
}

const getUidLink = (uid: string): string => {
  if (!uid.startsWith(`${packageName}!`)) {
    return `\`${getUidDisplayName(uid)}\``
  }

  const [, objectName] = uid.split('!')
  const [object, kind] = objectName.split(':')
  const [parent, name] = object.split('#')
  const displayName = name ?? parent
  const anchor = name != null ? `${parent}.${displayName}` : displayName

  return `[${displayName}](${docsBasePath}#${kind}_${anchor})`
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

  const [, objectName] = uid.split('!')
  const [object, kind] = objectName.split(':')
  const [parent, name] = object.split('#')
  const anchor = name != null ? `${parent}.${name}` : parent

  return `[${displayName}](${docsBasePath}#${kind}_${anchor})`
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
    .replace(/`/g, '\\`')
    .trim()

const renderParagraph = (value?: string): string =>
  value != null && value !== '' ? `${formatText(value)}\n\n` : ''

const renderRemarks = (value?: string): string =>
  value != null && value !== ''
    ? `${formatText(value)
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n')}\n\n`
    : ''

const renderSignatureBlock = (content?: string): string =>
  content != null && content !== ''
    ? `\`\`\`typescript
${formatCode(content)}
\`\`\`
`
    : ''

const shouldRenderItemsTable = (items?: DocParameter[]): boolean =>
  items != null &&
  items.length > 0 &&
  items.some(item => item.description != null && item.description !== '')

const renderItemsTable = (title: string, items?: DocParameter[]): string => {
  if (!shouldRenderItemsTable(items)) return ''
  const resolvedItems = items ?? []

  const rows = resolvedItems
    .map((item, index) => {
      const name = `\`${item.id ?? item.name ?? `value${index}`}\``
      const type = `\`${formatTableCode(item.type ?? item.syntax?.return?.type ?? 'unknown')}\``
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
  if (syntax?.return == null) return ''
  const description =
    syntax.return.description != null && syntax.return.description !== ''
      ? formatTableText(syntax.return.description)
      : ''
  if (description === '') return ''
  return `**Returns**

| Type | Description |
| --- | --- |
| \`${formatTableCode(syntax.return.type)}\` | ${description} |
`
}

const renderMemberSummary = (member: DocMember): string =>
  `${renderParagraph(member.summary)}${renderRemarks(member.remarks)}`

const renderProperty = (
  property: DocMember,
  ownerName: string
): string => `#### ++dnt++${ownerName}.${property.name.split('(')[0]}

${renderMemberSummary(property)}${renderSignatureBlock(property.syntax?.content)}
`

const renderMethod = (
  method: DocMember,
  ownerName: string
): string => `#### ++dnt++${ownerName}.${method.name.split('(')[0]}

${renderMemberSummary(method)}${renderSignatureBlock(method.syntax?.content)}${renderItemsTable(
  'Parameters',
  method.syntax?.parameters
)}${renderReturnTable(method.syntax)}
`

const renderConstructor = (
  constructor: DocMember
): string => `#### ++dnt++constructor

${renderMemberSummary(constructor)}${renderSignatureBlock(constructor.syntax?.content)}${renderItemsTable(
  'Parameters',
  constructor.syntax?.parameters
)}
`

const renderTopLevelFunction = (
  docItem: DocMember
): string => `## function ++dnt++${docItem.name.split('(')[0]}

${renderMemberSummary(docItem)}${renderSignatureBlock(docItem.syntax?.content)}${renderItemsTable(
  'Parameters',
  docItem.syntax?.parameters
)}${renderReturnTable(docItem.syntax)}
`

const renderClass = (declarations: DocDeclaration): string => {
  const constructors = declarations.constructors ?? []
  const properties = declarations.properties ?? []
  const methods = declarations.methods ?? []

  return `## class ++dnt++${declarations.name}

${renderParagraph(declarations.summary)}${renderRemarks(
    declarations.remarks
  )}${renderSignatureBlock(declarations.syntax)}${
    constructors.length > 0
      ? `### Constructors

${constructors.map(member => renderConstructor(member)).join('\n')}`
      : ''
  }${
    properties.length > 0
      ? `### Properties

${properties
  .map(member => renderProperty(member, declarations.name))
  .join('\n')}`
      : ''
  }${
    methods.length > 0
      ? `### Methods

${methods.map(member => renderMethod(member, declarations.name)).join('\n')}`
      : ''
  }
`
}

const renderInterface = (declarations: DocDeclaration): string => {
  const properties = declarations.properties ?? []

  return `## interface ++dnt++${declarations.name}

${renderParagraph(declarations.summary)}${renderRemarks(declarations.remarks)}${
    declarations.extends != null && declarations.extends !== ''
      ? `Extends ${formatText(declarations.extends)}.\n\n`
      : ''
  }${
    properties.length > 0
      ? `### Properties

${properties
  .map(member => renderProperty(member, declarations.name))
  .join('\n')}`
      : ''
  }
`
}

const renderType = (
  declarations: DocDeclaration
): string => `## type ++dnt++${declarations.name}

${renderParagraph(declarations.summary)}${renderRemarks(
  declarations.remarks
)}${renderSignatureBlock(declarations.syntax)}
`

const renderEnum = (declarations: DocDeclaration): string => {
  const fields = declarations.fields ?? []

  return `## enum ++dnt++${declarations.name}

${renderParagraph(declarations.summary)}${renderRemarks(declarations.remarks)}${
    fields.length > 0
      ? `| Name | Value | Description |
| --- | --- | --- |
${fields
  .map(
    field =>
      `| \`${field.name}\` | \`${formatTableCode(field.value)}\` | ${
        field.summary != null && field.summary !== ''
          ? formatTableText(field.summary)
          : ' '
      } |`
  )
  .join('\n')}
`
      : ''
  }
`
}

const renderPackage = (declarations: DocDeclaration): string => `
## ${declarations.name}

### Install

\`\`\`bash
pnpm add ${declarations.name}
\`\`\`

### ${referenceConfig.quickStartTitle}

\`\`\`${referenceConfig.quickStartLanguage}
${referenceConfig.quickStartImport}
\`\`\`

### Classes

${(declarations.classes ?? []).map(uid => `- ${getUidLink(uid)}`).join('\n')}

### Interfaces

${(declarations.interfaces ?? []).map(uid => `- ${getUidLink(uid)}`).join('\n')}

### Types

${(declarations.typeAliases ?? []).map(uid => `- ${getUidLink(uid)}`).join('\n')}

### Enums

${(declarations.enums ?? []).map(uid => `- ${getUidLink(uid)}`).join('\n')}

### Functions

${(declarations.functions ?? [])
  .map(
    func =>
      `- [${func.name.split('(')[0]}](${docsBasePath}#function_${func.name.split('(')[0]})`
  )
  .join('\n')}
`

const renderDeclaration = (declarations: DocDeclaration): string => {
  switch (declarations.uid?.split(':')?.[1]) {
    case 'class':
      return renderClass(declarations)
    case 'interface':
      return renderInterface(declarations)
    case 'type':
      return renderType(declarations)
    case 'enum':
      return renderEnum(declarations)
    default:
      return declarations.type === 'package' ? renderPackage(declarations) : ''
  }
}

const prioritize =
  <T>(predicate: (item: T) => boolean) =>
  (a: T, b: T): number =>
    Number(predicate(b)) - Number(predicate(a))

const sortDeclarations = (files: DocDeclaration[]): DocDeclaration[] =>
  [...files]
    .sort(prioritize(file => file.uid?.split(':')?.[1] === 'enum'))
    .sort(prioritize(file => file.uid?.split(':')?.[1] === 'type'))
    .sort(prioritize(file => file.uid?.split(':')?.[1] === 'interface'))
    .sort(prioritize(file => file.uid?.split(':')?.[1] === 'class'))
    .sort(prioritize(file => file.name === 'Organ'))
    .sort(prioritize(file => file.name === 'Organigram'))
    .sort(prioritize(file => file.name === 'OrganigramClient'))
    .sort(prioritize(file => file.name === packageName))

const markdown = async ({
  files
}: {
  files: DocDeclaration[]
}): Promise<void> => {
  return await new Promise((resolve, reject) => {
    let writeStream: fs.WriteStream
    try {
      writeStream = fs.createWriteStream(docsOutputPath, { flags: 'w' })
    } catch (error) {
      reject(error)
      return
    }

    writeStream.on('error', reject)
    writeStream.on('finish', resolve)

    writeStream.write(`export const metadata = { title: "${referenceConfig.title}", order: ${referenceConfig.order} }

# ${referenceConfig.heading}

${referenceConfig.description}

`)

    const orderedFiles = sortDeclarations(files)

    orderedFiles.forEach(file => {
      writeStream.write(renderDeclaration(file))
      writeStream.write('\n')

      if (file.type === 'package' && (file.functions?.length ?? 0) > 0) {
        const functions = file.functions ?? []
        writeStream.write(`
## Utility functions

`)
        functions.forEach(func => {
          writeStream.write(renderTopLevelFunction(func))
          writeStream.write('\n')
        })
      }
    })

    writeStream.end()
  })
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
