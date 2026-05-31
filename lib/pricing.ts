import Stripe from 'stripe'

const IPFS_STORAGE_BYTES_PER_GB = 1_000_000_000

const convertStripeStorageEuroPerUnitToEuroPerGb = (
  euroPerUnit: number
): number => Math.max(0, euroPerUnit) * IPFS_STORAGE_BYTES_PER_GB

export const publicPricingKeys = [
  'soloMonthly',
  'sponsoredTransactions',
  'signatures',
  'storage'
] as const

export type PublicPricingKey = (typeof publicPricingKeys)[number]

export type PublicPricingSource = 'stripe' | 'stripe_usage' | 'documented'

export interface PublicPricingItem {
  key: PublicPricingKey
  label: string
  price: string
  details?: string
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
  envKey: string
  buildItem: (price: Stripe.Price) => PublicPricingItem
}

const formatEuroAmount = (amount: number): string => {
  const hasDecimals = Math.abs(amount - Math.round(amount)) > 0.000001
  return `${amount.toLocaleString('fr-FR', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  })}€`
}

const getEuroAmountFromStripePrice = (price: Stripe.Price): number | null => {
  const rawAmount =
    price.unit_amount_decimal ??
    (price.unit_amount != null ? price.unit_amount.toString() : null)
  if (rawAmount == null) return null
  const parsed = Number.parseFloat(rawAmount)
  return Number.isFinite(parsed) ? parsed / 100 : null
}

const getPerUnitPriceLabel = (
  price: Stripe.Price,
  unitLabel?: string,
  multiplier?: number
): string => {
  const amount = getEuroAmountFromStripePrice(price)
  if (amount == null) return 'Unavailable'
  return `${formatEuroAmount(amount * (multiplier ?? 1))}${
    unitLabel != null ? ` / ${unitLabel}` : ''
  }`
}

const getStoragePriceLabel = (price: Stripe.Price): string => {
  const amount = getEuroAmountFromStripePrice(price)
  if (amount == null) return 'Unavailable'

  return `${formatEuroAmount(
    convertStripeStorageEuroPerUnitToEuroPerGb(amount)
  )} / GB / month`
}

const getDocumentedGasMultiplier = (): string =>
  process.env.NEXT_PUBLIC_GAS_SERVICE_FEE_MULTIPLIER ?? '2'

const getDocumentedMinimumTransactionAmount = (): string =>
  process.env.NEXT_PUBLIC_MINIMUM_TRANSACTION_AMOUNT_EURO ?? '0.01'

const pricingConfigs: Record<PublicPricingKey, PricingConfig> = {
  soloMonthly: {
    envKey: 'NEXT_PUBLIC_CERTIFIED_SOLO_MONTHLY_BASE_PRICE_ID',
    buildItem: price => ({
      key: 'soloMonthly',
      label: 'ID Certificates',
      price: getPerUnitPriceLabel(price, 'address / month'),
      details:
        "Minimum amount charged monthly to keep a certification active. This allows to generate advanced e-signatures tied to a user's wallet.",
      source: 'stripe'
    })
  },
  sponsoredTransactions: {
    envKey: 'NEXT_PUBLIC_GAS_PRICE_ID',
    buildItem: () => ({
      key: 'sponsoredTransactions',
      label: 'Sponsored transactions',
      price:
        '~x' +
        getDocumentedGasMultiplier() +
        ' gas used, min. ' +
        getDocumentedMinimumTransactionAmount() +
        '€',
      details: `Only the gas actually used is charged when sponsoring transactions, including relayer costs, processing fees and price fluctuations. Price is in Euro at currency rates updated every minute, with a minimum of ${getDocumentedMinimumTransactionAmount()}€.`,
      source: 'stripe_usage'
    })
  },
  signatures: {
    envKey: 'NEXT_PUBLIC_SIGNATURES_PRICE_ID',
    buildItem: price => ({
      key: 'signatures',
      label: 'Advanced digital signatures',
      price: getPerUnitPriceLabel(price, 'signature'),
      details:
        'Certified signatures for legally binding actions included in both Certified Solo and Certified Entity plans.',
      source: 'stripe'
    })
  },
  storage: {
    envKey: 'NEXT_PUBLIC_STORAGE_PRICE_ID',
    buildItem: price => ({
      key: 'storage',
      label: 'Certified storage (above 1GB)',
      price: getStoragePriceLabel(price),
      details:
        'Certified encrypted storage above 1GB is charged monthly for both organizations and personal workspaces.',
      source: 'stripe'
    })
  }
}

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
        const price = await getStripe().prices.retrieve(
          getPriceId(config.envKey)
        )
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
