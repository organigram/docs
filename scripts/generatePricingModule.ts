/* eslint-disable security/detect-non-literal-fs-filename */
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type { PublicPricingItem, PublicPricingResponse } from '../lib/pricing'

const outputFile = path.resolve(
  import.meta.dirname,
  '../lib/generatedPricing.json'
)

const readExistingPricing = async (
  file: string
): Promise<PublicPricingResponse | undefined> => {
  try {
    const existing = JSON.parse(
      await fs.readFile(file, 'utf8')
    ) as Partial<PublicPricingResponse> | null

    if (existing?.items != null && Array.isArray(existing.items)) {
      return existing as PublicPricingResponse
    }
  } catch (error) {
    console.error('Failed to read existing generated pricing fallback.', error)
  }

  return undefined
}

const mergePricingItems = (
  pricing: PublicPricingResponse,
  replacementItems: PublicPricingItem[]
): PublicPricingResponse => {
  const replacementsByKey = new Map(
    replacementItems.map(item => [item.key, item] as const)
  )
  const replacedKeys = new Set<PublicPricingItem['key']>()
  const items = pricing.items.map(item => {
    const replacement = replacementsByKey.get(item.key)

    if (replacement == null) {
      return item
    }

    replacedKeys.add(item.key)
    return replacement
  })

  for (const replacement of replacementItems) {
    if (!replacedKeys.has(replacement.key)) {
      items.push(replacement)
    }
  }

  return {
    ...pricing,
    items
  }
}

export const generatePricingModule = async ({
  outputFile,
  loadPricing,
  loadLocalPricingItems
}: {
  outputFile: string
  loadPricing?: () => Promise<PublicPricingResponse>
  loadLocalPricingItems?: () => Promise<PublicPricingItem[]>
}): Promise<PublicPricingResponse> => {
  const loadPublicPricing =
    loadPricing ??
    (async (): Promise<PublicPricingResponse> => {
      const { getPublicPricing } = await import('../lib/pricing')
      return getPublicPricing()
    })
  const loadLocalPublicPricingItems =
    loadLocalPricingItems ??
    (async (): Promise<PublicPricingItem[]> => {
      const { getLocalPublicPricingItems } = await import('../lib/pricing')
      return getLocalPublicPricingItems()
    })

  let generatedPublicPricing: PublicPricingResponse | undefined

  try {
    generatedPublicPricing = await loadPublicPricing()
  } catch (error) {
    console.error(
      'Failed to load pricing from Stripe while generating the static module. Reusing existing generated pricing.',
      error
    )
    generatedPublicPricing = await readExistingPricing(outputFile)
    if (generatedPublicPricing != null) {
      generatedPublicPricing = mergePricingItems(
        generatedPublicPricing,
        await loadLocalPublicPricingItems()
      )
    }
  }

  if (generatedPublicPricing == null) {
    throw new Error('Unable to generate pricing module and no valid fallback exists.')
  }

  await fs.writeFile(
    outputFile,
    JSON.stringify(generatedPublicPricing, null, 2),
    'utf8'
  )
  console.info(
    `Generated ${path.relative(path.resolve(import.meta.dirname, '..'), outputFile)}.`
  )

  return generatedPublicPricing
}

const main = async (): Promise<void> => {
  await generatePricingModule({ outputFile })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
