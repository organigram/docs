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
  'soloMonthly',
  'sponsoredTransactions',
  'signatures',
  'storage',
  'aiUsage'
] as const

export type PublicPricingKey = (typeof publicPricingKeys)[number]

export type PublicPricingSource = 'stripe' | 'stripe_usage' | 'documented'

export interface PublicPricingItem {
  key: PublicPricingKey
  label: string
  price: string
  priceKey?: string
  priceValues?: Record<string, string>
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
  buildItem: (
    price?: Stripe.Price
  ) => PublicPricingItem | Promise<PublicPricingItem>
}

const formatEuroAmount = (amount: number): string => {
  const hasDecimals = Math.abs(amount - Math.round(amount)) > 0.000001
  return `${amount.toLocaleString('fr-FR', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  })}€`
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
  price: Stripe.Price
): Pick<PublicPricingItem, 'price' | 'priceKey' | 'priceValues'> => {
  const amount = getEuroAmountFromStripePrice(price)
  if (amount == null) return buildUnavailablePriceFields()

  return buildPriceFields('{{price}} / GB / month', {
    price: formatEuroAmount(convertStripeStorageEuroPerUnitToEuroPerGb(amount))
  })
}

const getDocumentedGasMultiplier = (): string =>
  process.env.NEXT_PUBLIC_GAS_SERVICE_FEE_MULTIPLIER ?? '2'

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

const pricingConfigs: Record<PublicPricingKey, PricingConfig> = {
  soloMonthly: {
    envKey: 'NEXT_PUBLIC_CERTIFIED_SOLO_MONTHLY_BASE_PRICE_ID',
    buildItem: price => {
      const priceFields =
        price == null
          ? buildUnavailablePriceFields()
          : getPerUnitPriceFields(price, '{{price}} / address / month')

      return {
        key: 'soloMonthly',
        label: 'ID Certificates',
        ...priceFields,
        details:
          "Minimum amount charged monthly to keep a certification active. This allows to generate advanced e-signatures tied to a user's wallet.",
        source: 'stripe'
      }
    }
  },
  sponsoredTransactions: {
    envKey: 'NEXT_PUBLIC_GAS_PRICE_ID',
    buildItem: () => {
      const priceValues = {
        gasMultiplier: getDocumentedGasMultiplier(),
        minimumAmount: `${getDocumentedMinimumTransactionAmount()}€`
      }

      return {
        key: 'sponsoredTransactions',
        label: 'Sponsored transactions',
        ...buildPriceFields(
          '~x{{gasMultiplier}} gas used, min. {{minimumAmount}}',
          priceValues
        ),
        details: `Only the gas actually used is charged when sponsoring transactions, including relayer costs, processing fees and price fluctuations. Price is in Euro at currency rates updated every minute, with a minimum of ${getDocumentedMinimumTransactionAmount()}€.`,
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
          'Advanced digital signatures for legally binding actions included in both Certified Solo and Certified Entity plans.',
        source: 'stripe'
      }
    }
  },
  storage: {
    envKey: 'NEXT_PUBLIC_STORAGE_PRICE_ID',
    buildItem: price => {
      const priceFields =
        price == null
          ? buildUnavailablePriceFields()
          : getStoragePriceFields(price)

      return {
        key: 'storage',
        label: 'Certified storage (above 1GB)',
        ...priceFields,
        details:
          'Certified encrypted storage above 1GB is charged monthly for both organizations and personal workspaces.',
        source: 'stripe'
      }
    }
  },
  aiUsage: {
    buildItem: async () => ({
      key: 'aiUsage',
      label: 'AI assistance (per 1M tokens)',
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

const getPriceId = (envKey: string): string => {
  const priceId = process.env[envKey]
  if (priceId == null || priceId === '') {
    throw new Error(`Missing pricing environment variable: ${envKey}`)
  }
  return priceId
}

export const getPublicPricing = async (): Promise<PublicPricingResponse> => {
  if (cachedPricing != null && cachedPricing.expiresAt > Date.now()) {
    return cachedPricing.value
  }

  try {
    const items = await Promise.all(
      publicPricingKeys.map(async key => {
        const config = pricingConfigs[key]
        const price =
          config.envKey == null
            ? undefined
            : await getStripe().prices.retrieve(getPriceId(config.envKey))
        return config.buildItem(price)
      })
    )

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
