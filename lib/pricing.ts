import Stripe from 'stripe'
import { parseFiniteNumber } from '@organigram/js'

export const getAiBillingPricingSnapshot = (
  env: Partial<NodeJS.ProcessEnv> = process.env
) => ({
  inputEurPer1MTokens: parseFiniteNumber(
    env.AI_BILLING_INPUT_EUR_PER_1M_TOKENS,
    2.5
  ),
  cachedInputEurPer1MTokens: parseFiniteNumber(
    env.AI_BILLING_CACHED_INPUT_EUR_PER_1M_TOKENS,
    0.25
  ),
  outputEurPer1MTokens: parseFiniteNumber(
    env.AI_BILLING_OUTPUT_EUR_PER_1M_TOKENS,
    15
  ),
  freeRequestLimit: Math.max(
    0,
    Math.trunc(parseFiniteNumber(env.AI_FREE_REQUEST_LIMIT, 5))
  )
})

const IPFS_STORAGE_BYTES_PER_GB = 1_000_000_000

const convertStripeStorageEuroPerUnitToEuroPerGb = (
  euroPerUnit: number
): number => Math.max(0, euroPerUnit) * IPFS_STORAGE_BYTES_PER_GB

export const publicPricingKeys = [
  'verifiedIdentity',
  'signatures',
  'storage',
  'sponsoredTransactions',
  'aiUsage',
  'essentialPlan',
  'boardPlan'
] as const

export type PublicPricingKey = (typeof publicPricingKeys)[number]

export type PublicPricingSource = 'stripe' | 'stripe_usage' | 'documented'

export interface PublicPricingItem {
  key: PublicPricingKey
  label: string
  price: string
  priceKey?: string
  priceValues?: Record<string, string>
  annualPrice?: string
  annualPriceKey?: string
  annualPriceValues?: Record<string, string>
  details?: string
  detailsKey?: string
  detailsValues?: Record<string, string>
  source: PublicPricingSource
}

export interface PublicPricingResponse {
  generatedAt: string
  items: PublicPricingItem[]
}

let stripe: Stripe | undefined

const getStripe = (): Stripe => {
  if (stripe == null) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2024-06-20'
    })
  }

  return stripe
}

const CACHE_TTL_MS = 5 * 60 * 1000

let cachedPricing:
  | {
      expiresAt: number
      value: PublicPricingResponse
    }
  | undefined

type PricingConfig = {
  envKey?: string
  annualEnvKey?: string
  buildItem: (
    price?: Stripe.Price,
    annualPrice?: Stripe.Price
  ) => PublicPricingItem | Promise<PublicPricingItem>
}

const formatEuroAmount = (amount: number): string => {
  const hasDecimals = Math.abs(amount - Math.round(amount)) > 0.000001
  return `${amount.toLocaleString('fr-FR', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  })}\u00a0€`
}

const interpolatePricingText = (
  template: string,
  values: Record<string, string>
): string =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template
  )

const buildPriceFields = (
  priceKey: string,
  priceValues: Record<string, string>
): Pick<PublicPricingItem, 'price' | 'priceKey' | 'priceValues'> => ({
  price: interpolatePricingText(priceKey, priceValues),
  priceKey,
  priceValues
})

const buildUnavailablePriceFields = (): Pick<
  PublicPricingItem,
  'price' | 'priceKey'
> => ({
  price: 'Unavailable',
  priceKey: 'Unavailable'
})

const getEuroAmountFromStripePrice = (price: Stripe.Price): number | null => {
  const rawAmount =
    price.unit_amount_decimal ??
    (price.unit_amount != null ? price.unit_amount.toString() : null)
  if (rawAmount == null) return null
  const parsed = Number.parseFloat(rawAmount)
  return Number.isFinite(parsed) ? parsed / 100 : null
}

const getPerUnitPriceFields = (
  price: Stripe.Price,
  priceKey: string,
  multiplier?: number
): Pick<PublicPricingItem, 'price' | 'priceKey' | 'priceValues'> => {
  const amount = getEuroAmountFromStripePrice(price)
  if (amount == null) return buildUnavailablePriceFields()

  return buildPriceFields(priceKey, {
    price: formatEuroAmount(amount * (multiplier ?? 1))
  })
}

const getStoragePriceFields = (
  price: Stripe.Price,
  priceKey = '{{price}} / GB / month'
): Pick<PublicPricingItem, 'price' | 'priceKey' | 'priceValues'> => {
  const amount = getEuroAmountFromStripePrice(price)
  if (amount == null) return buildUnavailablePriceFields()

  return buildPriceFields(priceKey, {
    price: formatEuroAmount(convertStripeStorageEuroPerUnitToEuroPerGb(amount))
  })
}

const buildAnnualPriceFields = (
  priceFields?: Pick<PublicPricingItem, 'price' | 'priceKey' | 'priceValues'>
): Pick<
  PublicPricingItem,
  'annualPrice' | 'annualPriceKey' | 'annualPriceValues'
> =>
  priceFields == null
    ? {}
    : {
        annualPrice: priceFields.price,
        annualPriceKey: priceFields.priceKey,
        annualPriceValues: priceFields.priceValues
      }

const getDocumentedMinimumTransactionAmount = (): string =>
  process.env.NEXT_PUBLIC_MINIMUM_TRANSACTION_AMOUNT_EURO ?? '0.01'

const AI_USAGE_PRICE_KEY = '{{inputRate}} input / {{outputRate}} output'

const AI_USAGE_DETAILS_KEY =
  'Workspace assistance and assisted organigram generation include {{freeRequestLimit}} successful requests before these rates apply.'

const getAiUsageFields = async (): Promise<
  Pick<
    PublicPricingItem,
    | 'price'
    | 'priceKey'
    | 'priceValues'
    | 'details'
    | 'detailsKey'
    | 'detailsValues'
  >
> => {
  const rates = await getAiBillingPricingSnapshot()
  const priceValues = {
    inputRate: formatEuroAmount(rates.inputEurPer1MTokens),
    outputRate: formatEuroAmount(rates.outputEurPer1MTokens)
  }
  const detailsValues = {
    freeRequestLimit: String(rates.freeRequestLimit)
  }

  return {
    ...buildPriceFields(AI_USAGE_PRICE_KEY, priceValues),
    details: interpolatePricingText(AI_USAGE_DETAILS_KEY, detailsValues),
    detailsKey: AI_USAGE_DETAILS_KEY,
    detailsValues
  }
}

const buildPlanItem = (
  key: PublicPricingKey,
  label: string,
  price?: Stripe.Price,
  annualPrice?: Stripe.Price
): PublicPricingItem => ({
  key,
  label,
  ...(price == null
    ? buildUnavailablePriceFields()
    : getPerUnitPriceFields(price, '{{price}} / month')),
  ...buildAnnualPriceFields(
    annualPrice == null
      ? undefined
      : getPerUnitPriceFields(annualPrice, '{{price}} / year')
  ),
  source: 'stripe'
})

const pricingConfigs: Record<PublicPricingKey, PricingConfig> = {
  verifiedIdentity: {
    envKey: 'NEXT_PUBLIC_CERTIFIED_ENTITY_ACTIVE_USER_PRICE_ID',
    annualEnvKey: 'NEXT_PUBLIC_CERTIFIED_ENTITY_ACTIVE_USER_YEARLY_PRICE_ID',
    buildItem: (price, annualPrice) => {
      const priceFields =
        price == null
          ? buildUnavailablePriceFields()
          : getPerUnitPriceFields(price, '{{price}} / month')
      const annualPriceFields =
        annualPrice == null
          ? undefined
          : getPerUnitPriceFields(annualPrice, '{{price}} / year')

      return {
        key: 'verifiedIdentity',
        label: 'Verified identity, per signer',
        ...priceFields,
        ...buildAnnualPriceFields(annualPriceFields),
        details:
          "Charged to the organization for each member holding a verified identity, beyond the ones included in its plan. It lets its holder sign with an advanced e-signature.",
        source: 'stripe'
      }
    }
  },
  sponsoredTransactions: {
    buildItem: () => {
      const priceValues = {
        minimumAmount: `${getDocumentedMinimumTransactionAmount()}€`
      }

      return {
        key: 'sponsoredTransactions',
        label: 'Sponsored transactions',
        ...buildPriceFields('From {{minimumAmount}}', priceValues),
        details: `Recording an operation on the network has a technical cost: Organigram covers it for your signers and bills only the actual cost, including processing fees, converted to euros every minute, with a minimum of ${getDocumentedMinimumTransactionAmount()}€.`,
        source: 'stripe_usage'
      }
    }
  },
  signatures: {
    envKey: 'NEXT_PUBLIC_SIGNATURES_PRICE_ID',
    buildItem: price => {
      const priceFields =
        price == null
          ? buildUnavailablePriceFields()
          : getPerUnitPriceFields(price, '{{price}} / signature')

      return {
        key: 'signatures',
        label: 'Advanced e-signatures',
        ...priceFields,
        details:
          'Advanced digital signatures with qualified certificates for signing legally binding actions that require high proof security.',
        source: 'stripe'
      }
    }
  },
  storage: {
    envKey: 'NEXT_PUBLIC_STORAGE_PRICE_ID',
    annualEnvKey: 'NEXT_PUBLIC_STORAGE_YEARLY_PRICE_ID',
    buildItem: (price, annualPrice) => {
      const priceFields =
        price == null
          ? buildUnavailablePriceFields()
          : getStoragePriceFields(price)
      const annualPriceFields =
        annualPrice == null
          ? undefined
          : getStoragePriceFields(annualPrice, '{{price}} / GB / year')

      return {
        key: 'storage',
        label: 'Additional certified storage',
        ...priceFields,
        ...buildAnnualPriceFields(annualPriceFields),
        details:
          "Certified encrypted storage above 1GB is charged monthly for both organizations and personal workspaces. Data is timestamped, versioned and encrypted with keys held by workspace members. Encrypted copies are replicated on a public decentralized storage network (IPFS): only workspace members can decrypt or modify them.",
        source: 'stripe'
      }
    }
  },
  essentialPlan: {
    envKey: 'NEXT_PUBLIC_CERTIFIED_ESSENTIAL_MONTHLY_PRICE_ID',
    annualEnvKey: 'NEXT_PUBLIC_CERTIFIED_ESSENTIAL_YEARLY_PRICE_ID',
    buildItem: (price, annualPrice) => buildPlanItem('essentialPlan', 'Essential', price, annualPrice)
  },
  boardPlan: {
    envKey: 'NEXT_PUBLIC_CERTIFIED_BOARD_MONTHLY_PRICE_ID',
    annualEnvKey: 'NEXT_PUBLIC_CERTIFIED_BOARD_YEARLY_PRICE_ID',
    buildItem: (price, annualPrice) => buildPlanItem('boardPlan', 'Board', price, annualPrice)
  },
  aiUsage: {
    buildItem: async () => ({
      key: 'aiUsage',
      label: 'Workspace Agent (per 1M tokens)',
      ...(await getAiUsageFields()),
      source: 'documented'
    })
  }
}

export const getLocalPublicPricingItems = async (): Promise<
  PublicPricingItem[]
> =>
  Promise.all(
    publicPricingKeys
      .filter(key => pricingConfigs[key].envKey == null)
      .map(async key => pricingConfigs[key].buildItem())
  )

const getPriceId = (
  envKey: string,
  env: Partial<NodeJS.ProcessEnv> = process.env
): string => {
  const priceId = env[envKey]
  if (priceId == null || priceId === '') {
    throw new Error(`Missing pricing environment variable: ${envKey}`)
  }
  return priceId
}

const getOptionalPriceId = (
  envKey: string,
  env: Partial<NodeJS.ProcessEnv> = process.env
): string | undefined => {
  const priceId = env[envKey]
  return priceId == null || priceId === '' ? undefined : priceId
}

export const buildPublicPricingItems = async ({
  env = process.env,
  retrievePrice
}: {
  env?: Partial<NodeJS.ProcessEnv>
  retrievePrice: (priceId: string) => Promise<Stripe.Price>
}): Promise<PublicPricingItem[]> =>
  Promise.all(
    publicPricingKeys.map(async key => {
      const config = pricingConfigs[key]
      const price =
        config.envKey == null
          ? undefined
          : await retrievePrice(getPriceId(config.envKey, env))
      const annualPriceId =
        config.annualEnvKey == null
          ? undefined
          : getOptionalPriceId(config.annualEnvKey, env)
      const annualPrice =
        annualPriceId == null ? undefined : await retrievePrice(annualPriceId)

      return config.buildItem(price, annualPrice)
    })
  )

export const getPublicPricing = async (): Promise<PublicPricingResponse> => {
  if (cachedPricing != null && cachedPricing.expiresAt > Date.now()) {
    return cachedPricing.value
  }

  try {
    const items = await buildPublicPricingItems({
      retrievePrice: async priceId => getStripe().prices.retrieve(priceId)
    })

    const value = {
      generatedAt: new Date().toISOString(),
      items
    }

    cachedPricing = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      value
    }

    return value
  } catch (error) {
    if (cachedPricing != null) {
      return cachedPricing.value
    }
    throw error
  }
}
