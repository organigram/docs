import * as fs from 'node:fs'
import * as path from 'node:path'

type PackageJson = {
  name: string
  types?: string
  exports?: Record<string, string | { types?: string; import?: string; default?: string }>
}

const packageDir = path.resolve(process.cwd(), process.argv[2] ?? '.')
const slug = process.argv[3]

if (slug == null || slug === '') {
  throw new Error('Usage: prepareTypeScriptReference.ts <packageDir> <slug>')
}

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(packageDir, 'package.json'), 'utf8')
) as PackageJson
const cacheDir = path.resolve(
  packageDir,
  '.organigram-docs-cache',
  slug
)
const entryDir = path.join(cacheDir, 'entry')

const toPosixPath = (value: string): string => value.split(path.sep).join('/')

const toDeclarationPath = (exportTarget: string): string =>
  exportTarget
    .replace(/^\.\//, '')
    .replace(/\.js$/, '.d.ts')
    .replace(/\.mjs$/, '.d.ts')
    .replace(/\.cjs$/, '.d.ts')

const getExportTargets = (): string[] => {
  const entries = packageJson.exports
  if (entries == null) {
    return [packageJson.types ?? 'dist/index.d.ts']
  }

  return Object.values(entries)
    .map(value => {
      if (typeof value === 'string') return value
      return value.types ?? value.import ?? value.default
    })
    .filter((value): value is string => value != null && value !== '')
    .map(toDeclarationPath)
}

fs.mkdirSync(path.join(cacheDir, 'api-model'), { recursive: true })
fs.mkdirSync(path.join(cacheDir, 'yaml'), { recursive: true })
fs.mkdirSync(path.join(cacheDir, 'tmp'), { recursive: true })
fs.mkdirSync(entryDir, { recursive: true })

const entryContent = `${Array.from(new Set(getExportTargets()))
  .map(target => {
    const absoluteTarget = path.resolve(packageDir, target)
    let relativeTarget = toPosixPath(path.relative(entryDir, absoluteTarget))
    if (!relativeTarget.startsWith('.')) {
      relativeTarget = `./${relativeTarget}`
    }
    return `export * from '${relativeTarget.replace(/\.d\.ts$/, '')}'`
  })
  .join('\n')}
`

fs.writeFileSync(path.join(entryDir, 'index.d.ts'), entryContent, 'utf8')

const apiExtractorConfig = {
  $schema:
    'https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json',
  mainEntryPointFilePath: `<projectFolder>/.organigram-docs-cache/${slug}/entry/index.d.ts`,
  bundledPackages: [],
  apiReport: {
    enabled: false
  },
  docModel: {
    enabled: true,
    apiJsonFilePath: `<projectFolder>/.organigram-docs-cache/${slug}/api-model/${slug}.api.json`
  },
  dtsRollup: {
    enabled: false
  },
  tsdocMetadata: {
    enabled: false
  },
  messages: {
    compilerMessageReporting: {
      default: {
        logLevel: 'warning'
      }
    },
    extractorMessageReporting: {
      default: {
        logLevel: 'warning'
      }
    },
    tsdocMessageReporting: {
      default: {
        logLevel: 'warning'
      }
    }
  }
}

fs.writeFileSync(
  path.join(cacheDir, 'api-extractor.json'),
  `${JSON.stringify(apiExtractorConfig, null, 2)}\n`,
  'utf8'
)
