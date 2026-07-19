import { spawn } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageDir = path.resolve(process.cwd(), process.argv[2] ?? '.')
const slug = process.argv[3]

if (slug == null || slug === '') {
  throw new Error('Usage: generatePackageTypeScriptReference.ts <packageDir> <slug>')
}

const cacheDir = path.join(packageDir, '.organigram-docs-cache', slug)
const tmpDir = path.join(cacheDir, 'tmp')
const nodeBin = process.execPath
const docsPackageDir = path.resolve(__dirname, '..')
const binExtension = process.platform === 'win32' ? '.cmd' : ''
const apiExtractorBin = path.join(
  docsPackageDir,
  'node_modules',
  '.bin',
  `api-extractor${binExtension}`
)
const apiDocumenterBin = path.join(
  docsPackageDir,
  'node_modules',
  '.bin',
  `api-documenter${binExtension}`
)

const run = async (
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv } = {}
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: packageDir,
      env: {
        ...process.env,
        TMPDIR: tmpDir,
        ...options.env
      },
      stdio: 'inherit'
    })

    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

await fs.mkdir(tmpDir, { recursive: true })

await run(nodeBin, [
  '--import',
  'tsx',
  path.join(__dirname, 'prepareTypeScriptReference.ts'),
  packageDir,
  slug
])

await run(apiExtractorBin, [
  'run',
  '--config',
  path.join(cacheDir, 'api-extractor.json'),
  '--local'
])

await run(apiDocumenterBin, [
  'yaml',
  '--input-folder',
  path.join(cacheDir, 'api-model'),
  '--output-folder',
  path.join(cacheDir, 'yaml')
])

await run(nodeBin, [
  '--import',
  'tsx',
  path.join(__dirname, 'generateTypeScriptReference.ts'),
  packageDir,
  slug,
  path.join(cacheDir, 'yaml')
])
