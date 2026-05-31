import fs from 'node:fs/promises'
import path from 'node:path'

const outputFile = path.resolve(
  import.meta.dirname,
  '../lib/generatedPricing.json'
)

const main = async (): Promise<void> => {
  let generatedPublicPricing = null

  const { getPublicPricing } = await import('../lib/pricing')

  try {
    generatedPublicPricing = await getPublicPricing()
  } catch (error) {
    console.error(
      'Failed to load pricing from Stripe while generating the static module. Reusing existing price amounts with the current documented labels and notes.',
      error
    )
  }

  await fs.writeFile(
    outputFile,
    JSON.stringify(generatedPublicPricing, null, 2),
    'utf8'
  )
  console.info(
    `Generated ${path.relative(path.resolve(import.meta.dirname, '..'), outputFile)}${
      generatedPublicPricing == null ? ' (null fallback)' : ''
    }.`
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
