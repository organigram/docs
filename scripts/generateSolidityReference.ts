import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

interface AbiParameter {
  type: string
  name?: string
  indexed?: boolean
  components?: AbiParameter[]
  description?: string
}

interface AbiDocEntry {
  type: string
  name?: string
  title?: string
  notice?: string
  details?: string
  inputs?: AbiParameter[]
  outputs?: AbiParameter[]
  stateMutability?: string
  signature?: string | false
}

interface MethodDocs {
  params?: Record<string, string>
  returns?: Record<string, string>
  notice?: string
  details?: string
}

interface ContractDevdoc {
  title?: string
  details?: string
  methods?: Record<string, MethodDocs>
  events?: Record<string, MethodDocs>
}

interface ContractUserdoc {
  notice?: string
  methods?: Record<string, Pick<AbiDocEntry, 'notice' | 'details'>>
  events?: Record<string, Pick<AbiDocEntry, 'notice' | 'details'>>
}

interface CompiledContract {
  name: string
  title?: string
  abi: AbiDocEntry[]
  abiDocs: DocumentedAbiEntry[]
  devdoc?: ContractDevdoc
  userdoc?: ContractUserdoc
}

interface ArtifactMetadata {
  settings?: {
    compilationTarget?: Record<string, string>
  }
  output: {
    devdoc?: ContractDevdoc
    userdoc?: ContractUserdoc
  }
}

interface ArtifactJson {
  abi: AbiDocEntry[]
  /** The compiler metadata as emitted by solc, with contract and event NatSpec. */
  rawMetadata?: string
  metadata?: {
    settings?: {
      compilationTarget?: Record<string, string>
    }
    output: {
      devdoc?: ContractDevdoc
      userdoc?: ContractUserdoc
    }
  }
}

interface DocumentedAbiEntry extends AbiDocEntry {
  inputs: AbiParameter[]
  outputs: AbiParameter[]
  signature?: string | false
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DOCS_OUTPUT_PATH = path.resolve(
  __dirname,
  '../mdx/reference/solidity.mdx'
)
const PROTOCOL_PATH = path.resolve(__dirname, '../../protocol')
const ABI_INPUT_PATH = path.resolve(PROTOCOL_PATH, 'abi')
const CACHE_TMP_PATH = path.resolve(
  __dirname,
  '../../protocol/.organigram-docs-cache/protocol/tmp'
)

interface ReferenceSection {
  title: string
  /** Hand-written paragraph introducing the section, in Markdown. */
  intro?: string
  /** Contracts documented in the section, in order. */
  names: string[]
}

// Sections group contracts by topic, each with a hand-written introduction.
const sections = JSON.parse(
  fs.readFileSync(path.resolve(PROTOCOL_PATH, 'reference.json'), 'utf8')
) as ReferenceSection[]
const includedContracts = new Set(sections.flatMap(section => section.names))

// The package README introduces the page, so it must stay valid MDX.
const introduction = fs
  .readFileSync(path.resolve(PROTOCOL_PATH, 'README.md'), 'utf8')
  .trim()

const escapeMDX = (value: unknown): string =>
  String(value ?? '')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .trim()

const sanitizeNotice = (value: unknown): string =>
  escapeMDX(value).replace(':warning: **Warning** :warning:', 'Warning:')

const canonicalType = (param: AbiParameter): string => {
  if (param.type.startsWith('tuple')) {
    const suffix = param.type.slice('tuple'.length)
    const inner = (param.components ?? []).map(canonicalType).join(', ')
    return `(${inner})${suffix}`
  }
  return param.type
}

// Solidity keys its NatSpec by signatures without spaces, tuples included.
const abiType = (param: AbiParameter): string =>
  param.type.startsWith('tuple')
    ? `(${(param.components ?? []).map(abiType).join(',')})${param.type.slice('tuple'.length)}`
    : param.type

const getArgumentName = (argument: AbiParameter, index: number): string =>
  argument.name != null && argument.name !== '' ? argument.name : `arg${index}`

const renderSignatureArguments = (
  argumentsList: AbiParameter[] = [],
  options: { event?: boolean } = {}
): string =>
  argumentsList
    .map((argument, index) => {
      const name = getArgumentName(argument, index)
      const type = canonicalType(argument)
      if (options.event === true) {
        return `${type}${argument.indexed === true ? ' indexed' : ''} ${name}`
      }
      return `${type} ${name}`
    })
    .join(', ')

const renderReturnsSignature = (outputs: AbiParameter[]): string => {
  if (outputs.length === 0) return ''
  return ` returns (${outputs
    .map((argument, index) => {
      const type = canonicalType(argument)
      return argument.name != null && argument.name !== ''
        ? `${type} ${getArgumentName(argument, index)}`
        : type
    })
    .join(', ')})`
}

const renderStateMutability = (method: DocumentedAbiEntry): string => {
  if (
    method.stateMutability == null ||
    ['nonpayable', 'view', 'pure', 'payable'].includes(method.stateMutability) ===
      false
  ) {
    return ''
  }
  return method.stateMutability === 'nonpayable'
    ? ''
    : ` ${method.stateMutability}`
}

const hasDocumentation = (items: AbiParameter[]): boolean =>
  items.some(item => item.description != null && item.description !== '')

const renderItemsTable = (title: string, items: AbiParameter[]): string => {
  if (items.length === 0 || !hasDocumentation(items)) return ''

  const rows = items
    .map((item, index) => {
      const name = `\`${getArgumentName(item, index)}\``
      const type = `\`${canonicalType(item)}\``
      const description =
        item.description != null && item.description !== ''
          ? escapeMDX(item.description)
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

const renderSignatureBlock = (signature: string): string => `\`\`\`solidity
${signature}
\`\`\`

`

/** Fold signatures and parameter tables, so that the page reads as explanations first. */
const renderDetails = (label: string, content: string): string =>
  content.trim() === ''
    ? ''
    : `<details>
<summary>${label}</summary>

${content.trim()}

</details>

`

const hasText = (value?: string): value is string =>
  value != null && value.trim() !== ''

const missingSummaries: string[] = []

const renderParagraph = (value?: string): string =>
  hasText(value) ? `${sanitizeNotice(value)}\n\n` : ''

const memberSignature = (member: DocumentedAbiEntry): string =>
  member.type === 'event'
    ? `event ${member.name}(${renderSignatureArguments(member.inputs, {
        event: true
      })});`
    : `function ${member.name}(${renderSignatureArguments(
        member.inputs
      )})${renderStateMutability(member)}${renderReturnsSignature(member.outputs)};`

const renderMember = (
  member: DocumentedAbiEntry,
  contract: CompiledContract
): string => {
  const name = `${contract.name}.${member.name ?? ''}`
  if (!hasText(member.notice) && !hasText(member.details)) {
    missingSummaries.push(name)
  }
  return `#### ++dnt++${name}

${renderParagraph(member.notice)}${renderParagraph(member.details)}${renderDetails(
    member.type === 'event' ? 'Event' : 'Signature',
    `${renderSignatureBlock(memberSignature(member))}${renderItemsTable(
      member.type === 'event' ? 'Arguments' : 'Parameters',
      member.inputs
    )}${renderItemsTable('Returns', member.outputs)}`
  )}`
}

const memberKey = (member: DocumentedAbiEntry): string =>
  `${member.type}:${member.signature ?? member.name ?? ''}`

// Each contract initializes its own parameters, so `initialize` is never inherited.
const inheritableKeys = (contract: CompiledContract): string[] =>
  contract.abiDocs
    .filter(isListedMember)
    .filter(member => member.name !== 'initialize')
    .map(memberKey)

const isListedMember = (member: DocumentedAbiEntry): boolean =>
  (member.type === 'function' || member.type === 'event') &&
  !(member.name === 'initialize' && member.inputs[0]?.name === '')

/** The largest other contract whose members this one all has: its parent or interface. */
const findParent = (
  contract: CompiledContract,
  contracts: CompiledContract[]
): CompiledContract | undefined => {
  const keys = new Set(inheritableKeys(contract))
  return contracts
    .filter(other => other !== contract)
    .map(other => ({ other, keys: inheritableKeys(other) }))
    .filter(({ keys: otherKeys }) => otherKeys.length > 0 && otherKeys.every(key => keys.has(key)))
    .sort((a, b) => b.keys.length - a.keys.length)[0]?.other
}

const renderContract = (
  contract: CompiledContract,
  contracts: CompiledContract[]
): string => {
  const summary =
    contract.userdoc?.notice ?? contract.devdoc?.title ?? contract.devdoc?.details
  if (!hasText(summary)) missingSummaries.push(contract.name)
  const parent = findParent(contract, contracts)
  const inherited = new Set(parent == null ? [] : inheritableKeys(parent))
  const constructor = contract.abiDocs.find(item => item.type === 'constructor')
  const members = contract.abiDocs
    .filter(isListedMember)
    .filter(member => !inherited.has(memberKey(member)))
    .sort(
      (a, b) =>
        Number(a.type === 'event') - Number(b.type === 'event') ||
        (a.name ?? '').localeCompare(b.name ?? '')
    )

  return `### ++dnt++${contract.name}

${
  hasText(summary)
    ? `<div data-summary>

${sanitizeNotice(summary)}

</div>

`
    : ''
}${
    hasText(contract.devdoc?.details) && contract.devdoc?.details !== summary
      ? renderParagraph(contract.devdoc?.details)
      : ''
  }${
    parent != null
      ? `It has every function and event of [${parent.name}](/docs/reference/solidity#${parent.name}), and the ones below.\n\n`
      : ''
  }${
    constructor != null
      ? renderDetails(
          'Constructor',
          renderSignatureBlock(
            `constructor(${renderSignatureArguments(constructor.inputs)});`
          )
        )
      : ''
  }${members.map(member => renderMember(member, contract)).join('')}`
}

function formatABI(
  method: AbiDocEntry,
  contract: { devdoc?: ContractDevdoc; userdoc?: ContractUserdoc }
): DocumentedAbiEntry {
  const inputParams = method.inputs ?? []
  const signature =
    method.name != null
      ? `${method.name}(${inputParams.map(abiType).join(',')})`
      : undefined
  const kind = method.type === 'event' ? 'events' : 'methods'
  const devDocs =
    signature != null ? (contract.devdoc?.[kind] ?? {})[signature] ?? {} : {}
  const userDocs =
    signature != null ? (contract.userdoc?.[kind] ?? {})[signature] ?? {} : {}
  const params = devDocs.params ?? {}
  const inputs = inputParams.map((param: AbiParameter) => ({
    ...param,
    description: param.name != null ? params[param.name] : undefined
  }))

  return {
    ...method,
    ...devDocs,
    ...userDocs,
    inputs,
    outputs: parseOutputs({ devDocs, method }),
    signature
  }
}

function parseOutputs({
  devDocs,
  method
}: {
  devDocs: MethodDocs
  method: AbiDocEntry
}): AbiParameter[] {
  let outputs: AbiParameter[] = []
  try {
    if (typeof devDocs.returns !== 'undefined') {
      const outputParams = devDocs.returns
      outputs = (method.outputs ?? []).map((param: AbiParameter) => ({
        ...param,
        description: param.name != null ? outputParams[param.name] : undefined
      }))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(
      `warning: invalid @return for ${method.name} - output may be affected\n${message}\n`
    )
    outputs = method.outputs ?? []
  }

  if (outputs.length === 0) {
    outputs = method.outputs ?? []
  }

  return outputs
}

function compile({
  contracts
}: {
  contracts: Record<string, { devdoc?: ContractDevdoc; userdoc?: ContractUserdoc; abi: AbiDocEntry[] }>
}): CompiledContract[] {
  const data: CompiledContract[] = []
  Object.keys(contracts).forEach(contractName => {
    const contract = contracts[contractName]
    data.push({
      ...contract,
      title: contract.devdoc?.title,
      name: contractName,
      abiDocs: contract.abi.map(abi => formatABI(abi, contract))
    })
  })

  return data.filter(contract => contract.abiDocs.length > 0)
}

const walkPath = (dir: string): string[] => {
  let results: string[] = []
  const list = fs.readdirSync(dir)

  list.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      results = results.concat(walkPath(filePath))
    } else {
      results.push(filePath)
    }
  })

  return results
}

async function markdown({ data }: { data: CompiledContract[] }): Promise<void> {
  const byName = new Map(data.map(contract => [contract.name, contract]))
  const content = `export const metadata = { title: "Solidity", order: 5.1 }

${introduction}

${sections
  .map(section => {
    const contracts = section.names
      .map(name => byName.get(name))
      .filter((contract): contract is CompiledContract => contract != null)
    return contracts.length === 0
      ? ''
      : `## ${section.title}

${hasText(section.intro) ? `${section.intro.trim()}\n\n` : ''}${contracts
          .map(contract => renderContract(contract, data))
          .join('')}`
  })
  .join('')}`
  await fs.promises.writeFile(DOCS_OUTPUT_PATH, content, 'utf8')

  if (missingSummaries.length > 0) {
    console.warn(
      `${missingSummaries.length} contracts or members have no NatSpec:\n  ${missingSummaries.join('\n  ')}`
    )
  }
}

function build(): Promise<void> {
  fs.mkdirSync(CACHE_TMP_PATH, { recursive: true })
  const files = walkPath(ABI_INPUT_PATH)
  const contracts = files.reduce<Record<string, { devdoc?: ContractDevdoc; userdoc?: ContractUserdoc; abi: AbiDocEntry[] }>>((acc, file) => {
    if (!file.endsWith('.json') || file.includes('/build-info/')) return acc

    const contract = JSON.parse(fs.readFileSync(file, 'utf8')) as ArtifactJson
    // Forge's parsed `metadata` drops contract titles and event docs.
    const metadata =
      contract.rawMetadata != null
        ? (JSON.parse(contract.rawMetadata) as ArtifactMetadata)
        : contract.metadata
    const compilationTarget = metadata?.settings?.compilationTarget
    const sourcePath = compilationTarget
      ? Object.keys(compilationTarget)[0]
      : undefined
    const contractName =
      sourcePath != null ? compilationTarget?.[sourcePath] : undefined

    if (
      sourcePath?.startsWith('contracts/') &&
      contractName != null &&
      includedContracts.has(contractName)
    ) {
      acc[contractName] = {
        ...(metadata?.output ?? {}),
        abi: contract.abi
      }
    }

    return acc
  }, {})

  return markdown({ data: compile({ contracts }) })
}

build()
  .then(() => {
    console.info('done!')
  })
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
