import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import type {
  ApiActionDoc,
  ApiOperationDoc,
  ApiRouteDocs,
  ApiVisibleRouteDocs,
  ApiRouteSection
} from './restApiTypes'

const getSourceRoot = (): string => {
  const cwd = process.cwd()
  const candidates = [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '../..')]
  return (
    candidates.find(candidate =>
      fs.existsSync(path.resolve(candidate, 'stack/lib/api/index.ts'))
    ) ?? candidates[0]!
  )
}

const sourceRoot = getSourceRoot()
const stackRoot = path.resolve(sourceRoot, 'stack')
const libDir = path.resolve(stackRoot, 'lib')
const outputPath = path.resolve(sourceRoot, 'packages/docs/mdx/reference/rest-api.mdx')
const docsPath = '/docs/reference/rest-api'

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

interface ActionEntry {
  name: string
  auth: string
  description: string
}

interface PreparedRoute extends ApiVisibleRouteDocs {
  path: string
  source: string
  notes: string[]
  actionEntries: ActionEntry[] | null
}

interface PreparedSection {
  title: ApiRouteSection
  routes: PreparedRoute[]
}

const sectionOrder: ApiRouteSection[] = [
  'Action routes',
  'Uploads and generated assets',
  'Authentication, billing, and integrations'
]

const walk = async (dir: string): Promise<string[]> => {
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) return await walk(fullPath)
      return fullPath
    })
  )

  return files.flat()
}

const toPosixPath = (value: string): string => value.split(path.sep).join('/')

const isRouteFile = (relativePath: string): boolean =>
  (relativePath === 'lib/api/index.ts' ||
    /^lib\/[^/]+\/api(?:\/.+)?\.ts$/.test(relativePath)) &&
  !relativePath.endsWith('/adapter.ts') &&
  !relativePath.endsWith('/utils.ts') &&
  !relativePath.endsWith('/docs.ts')

const getRoutePath = (relativePath: string): string => {
  if (relativePath === 'lib/api/index.ts') {
    return '/api'
  }

  const match = relativePath.match(/^lib\/([^/]+)\/api(?:\/(.+))?\.ts$/)
  if (match == null) {
    throw new Error(`Unsupported API route source path: ${relativePath}.`)
  }

  const [, domain, nestedPath = ''] = match
  const normalized = `/api/${domain}${nestedPath === '' ? '' : `/${nestedPath}`}`
  return normalized.endsWith('/index')
    ? normalized.slice(0, -'/index'.length)
    : normalized
}

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

const slugify = (value: unknown): string =>
  String(value ?? '')
    .replace(/\+\+dnt\+\+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')

const formatRouteLabel = (routePath: string): string =>
  String(routePath).replace(/\[/g, '\\[').replace(/\]/g, '\\]')

const getRouteAnchor = (routePath: string): string =>
  slugify(`route ${routePath}`)

const getUniqueMatches = (source: string, regex: RegExp): string[] => {
  const matches: string[] = []
  const seen = new Set<string>()

  for (const match of source.matchAll(regex)) {
    const value = match[1]
    if (value == null || seen.has(value)) continue
    seen.add(value)
    matches.push(value)
  }

  return matches
}

const extractActionNames = (source: string): string[] => {
  const actionNames = [
    ...getUniqueMatches(source, /body\.action\s*===\s*['"`]([^'"`]+)['"`]/g),
    ...getUniqueMatches(source, /case\s+['"`]([^'"`]+)['"`]\s*:/g)
  ]

  return actionNames.filter(
    (actionName, index) => actionNames.indexOf(actionName) === index
  )
}

const isBodyParserDisabled = (source: string): boolean =>
  /bodyParser\s*:\s*false/.test(source)

const unwrapExpression = (node: ts.Expression): ts.Expression => {
  let current = node

  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression
  }

  return current
}

const getPropertyName = (name: ts.PropertyName): string => {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text
  }

  throw new Error(
    `Unsupported property name kind: ${ts.SyntaxKind[name.kind]}.`
  )
}

const evaluateExpression = (node: ts.Expression): JsonValue => {
  const expression = unwrapExpression(node)

  if (ts.isObjectLiteralExpression(expression)) {
    return Object.fromEntries(
      expression.properties.map(property => {
        if (!ts.isPropertyAssignment(property)) {
          throw new Error(
            `Unsupported object property kind: ${ts.SyntaxKind[property.kind]}.`
          )
        }

        return [
          getPropertyName(property.name),
          evaluateExpression(property.initializer)
        ]
      })
    )
  }

  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.map(element => evaluateExpression(element))
  }

  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return expression.text
  }

  if (ts.isNumericLiteral(expression)) {
    return Number(expression.text)
  }

  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false
  if (expression.kind === ts.SyntaxKind.NullKeyword) return null

  throw new Error(
    `Unsupported apiDocs value kind: ${ts.SyntaxKind[expression.kind]}.`
  )
}

const getApiDocsInitializer = (
  sourceFile: ts.SourceFile
): ts.Expression | null => {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue

    const isExported =
      statement.modifiers?.some(
        modifier => modifier.kind === ts.SyntaxKind.ExportKeyword
      ) ?? false

    if (!isExported) continue

    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === 'apiDocs' &&
        declaration.initializer != null
      ) {
        return declaration.initializer
      }
    }
  }

  return null
}

const readApiDocs = (source: string, relativePath: string): ApiRouteDocs => {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const initializer = getApiDocsInitializer(sourceFile)

  if (initializer == null) {
    throw new Error(`Missing exported apiDocs metadata in ${relativePath}.`)
  }

  return evaluateExpression(initializer) as unknown as ApiRouteDocs
}

const isVisibleApiDocs = (
  apiDocs: ApiRouteDocs
): apiDocs is ApiVisibleRouteDocs => apiDocs.hidden !== true

const getActionDocumentation = (
  docs: Record<string, ApiActionDoc>,
  actionName: string,
  routeAuth: string
): ActionEntry => {
  const item = docs[actionName]
  if (item == null) {
    throw new Error(`Missing documentation for action "${actionName}".`)
  }

  if (typeof item === 'string') {
    return {
      name: actionName,
      auth: routeAuth,
      description: item
    }
  }

  return {
    name: actionName,
    auth: item.auth ?? routeAuth,
    description: item.description
  }
}

const validateRouteDocs = (route: PreparedRoute): void => {
  if (!sectionOrder.includes(route.section)) {
    throw new Error(`Unknown section "${route.section}" for ${route.source}.`)
  }

  if (typeof route.order !== 'number' || Number.isNaN(route.order)) {
    throw new Error(`Missing numeric order for ${route.source}.`)
  }

  if (
    typeof route.summary !== 'string' ||
    typeof route.auth !== 'string' ||
    typeof route.body !== 'string'
  ) {
    throw new Error(`Invalid string metadata in ${route.source}.`)
  }

  if (!Array.isArray(route.methods) || route.methods.length === 0) {
    throw new Error(`Missing HTTP methods for ${route.source}.`)
  }
}

const prepareRoute = async (
  absolutePath: string
): Promise<PreparedRoute | null> => {
  const relativePath = toPosixPath(path.relative(stackRoot, absolutePath))
  const source = await fsp.readFile(absolutePath, 'utf8')
  const apiDocs = readApiDocs(source, relativePath)

  if (!isVisibleApiDocs(apiDocs)) {
    return null
  }

  const routePath = getRoutePath(relativePath)
  const notes = [...(apiDocs.notes ?? [])]

  if (apiDocs.actions != null && routePath !== '/api') {
    notes.push('Also reachable through `/api` with the same `action` payload.')
  }

  if (isBodyParserDisabled(source)) {
    notes.push('The default Next.js body parser is disabled for this route.')
  }

  let actionEntries: ActionEntry[] | null = null
  const actions = apiDocs.actions
  if (actions != null) {
    const actionNames = extractActionNames(source)
    const documentedActionNames = Object.keys(actions)
    const missing = actionNames.filter(
      actionName => !documentedActionNames.includes(actionName)
    )
    const unexpected = documentedActionNames.filter(
      actionName => !actionNames.includes(actionName)
    )

    if (missing.length > 0 || unexpected.length > 0) {
      throw new Error(
        [
          `Action docs drift detected for ${routePath}.`,
          missing.length > 0 ? `Missing docs: ${missing.join(', ')}.` : null,
          unexpected.length > 0
            ? `Unknown docs entries: ${unexpected.join(', ')}.`
            : null
        ]
          .filter(Boolean)
          .join(' ')
      )
    }

    actionEntries = actionNames.map(actionName =>
      getActionDocumentation(actions, actionName, apiDocs.auth)
    )
  }

  const route = {
    ...apiDocs,
    path: routePath,
    source: relativePath,
    notes,
    actionEntries
  }

  validateRouteDocs(route)
  return route
}

const renderSummaryList = (routes: PreparedRoute[]): string =>
  routes
    .map(
      route =>
        `- [${formatRouteLabel(route.path)}](${docsPath}#${getRouteAnchor(
          route.path
        )}): ${formatText(route.summary)}`
    )
    .join('\n')

const renderRouteInfoTable = (route: PreparedRoute): string => {
  const notesRow: Array<[string, string]> =
    route.notes.length > 0 ? [['Notes', route.notes.join(' ')]] : []
  const rows: Array<[string, string]> = [
    ['Methods', route.methods.map(method => `\`${method}\``).join(', ')],
    ['Auth', route.auth],
    ['Body', route.body],
    ...notesRow
  ]

  return `| Field | Value |
| --- | --- |
${rows
  .map(([field, value]) => `| ${field} | ${formatTableText(value)} |`)
  .join('\n')}
`
}

const renderActionTable = (actionEntries: ActionEntry[]): string => `**Actions**

| Action | Auth | Description |
| --- | --- | --- |
${actionEntries
  .map(
    action =>
      `| \`${formatTableText(action.name)}\` | ${formatTableText(
        action.auth
      )} | ${formatTableText(action.description)} |`
  )
  .join('\n')}
`

const renderOperationsTable = (
  operations: ApiOperationDoc[]
): string => `**Operations**

| Operation | Trigger | Auth | Description |
| --- | --- | --- | --- |
${operations
  .map(
    operation =>
      `| \`${formatTableText(operation.name)}\` | ${
        operation.trigger != null && operation.trigger !== ''
          ? formatTableText(operation.trigger)
          : ' '
      } | ${formatTableText(operation.auth ?? '') || ' '} | ${formatTableText(
        operation.description
      )} |`
  )
  .join('\n')}
`

const renderRoute = (route: PreparedRoute): string => `<span id="${getRouteAnchor(
  route.path
)}"></span>

### ++dnt++${route.path}

${formatText(route.summary)}

${renderRouteInfoTable(route)}

${
  route.actionEntries != null
    ? `${renderActionTable(route.actionEntries)}\n`
    : route.operations != null && route.operations.length > 0
      ? `${renderOperationsTable(route.operations)}\n`
      : ''
}`

const renderSection = (section: PreparedSection): string => `## ${section.title}

${section.routes.map(renderRoute).join('\n')}`

const main = async (): Promise<void> => {
  const routeFiles: string[] = (await walk(libDir))
    .map(filePath => toPosixPath(path.relative(stackRoot, filePath)))
    .filter(isRouteFile)
    .map(relativePath => path.resolve(stackRoot, relativePath))
    .sort((a, b) => a.localeCompare(b))

  const preparedRoutes: PreparedRoute[] = (
    await Promise.all(routeFiles.map(prepareRoute))
  ).filter((route): route is PreparedRoute => route != null)

  for (const section of sectionOrder) {
    const seenOrders = new Set<number>()

    for (const route of preparedRoutes.filter(
      item => item.section === section
    )) {
      if (seenOrders.has(route.order)) {
        throw new Error(
          `Duplicate order ${route.order} in section "${section}".`
        )
      }
      seenOrders.add(route.order)
    }
  }

  const preparedSections: PreparedSection[] = sectionOrder
    .map(title => ({
      title,
      routes: preparedRoutes
        .filter(route => route.section === title)
        .sort((a, b) => a.order - b.order || a.path.localeCompare(b.path))
    }))
    .filter(section => section.routes.length > 0)

  const summarySections: string = preparedSections
    .map(
      section => `### ${section.title}

${renderSummaryList(section.routes)}
`
    )
    .join('\n')

  const details: string = preparedSections.map(renderSection).join('\n\n')

  const document = `export const metadata = { title: "🌐 Web API", order: 5.35 }

# Web API 🌐

The official reference for the API routes used by Organigram.ai. Unlike the package references, these endpoints document the application layer itself, including RPC-style JSON routes, uploads, authentication callbacks, webhooks, and server-side integrations.

## Conventions

- Most application mutations are sent as \`POST\` requests with a JSON body containing an \`action\` field.
- Upload and webhook routes disable the default Next.js body parser when they need raw bodies or \`multipart/form-data\`.
- Authentication varies by route: some endpoints are public, while others require a NextAuth session, a walletless token, or a provider-specific secret.

## Route summary

${summarySections}

${details}
`

  await fsp.writeFile(outputPath, document, 'utf8')
  console.info(`Generated ${path.relative(sourceRoot, outputPath)}.`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
