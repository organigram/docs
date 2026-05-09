import fs from 'node:fs/promises'
import path from 'node:path'

const outputFile = path.resolve(
  import.meta.dirname,
  '../lib/generatedPricing.json'
)

const readExistingPricing = async (): Promise<unknown | null> => {
  try {
    const content = await fs.readFile(outputFile, 'utf8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

const main = async (): Promise<void> => {
  let generatedPublicPricing = null
  let usedExistingFallback = false

  try {
    const { getPublicPricing } = await import('../lib/pricing')
    generatedPublicPricing = await getPublicPricing()
  } catch (error) {
    console.error(
      'Failed to load pricing from Stripe while generating the static module. Reusing the existing static pricing module when available.',
      error
    )
    generatedPublicPricing = await readExistingPricing()
    usedExistingFallback = generatedPublicPricing != null
  }

  await fs.writeFile(
    outputFile,
    JSON.stringify(generatedPublicPricing, null, 2),
    'utf8'
  )
  console.info(
    `Generated ${path.relative(path.resolve(import.meta.dirname, '..'), outputFile)}${
      generatedPublicPricing == null
        ? ' (null fallback)'
        : usedExistingFallback
          ? ' (existing fallback)'
          : ''
    }.`
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
