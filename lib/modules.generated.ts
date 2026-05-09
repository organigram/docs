/* eslint-disable */
// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Run: pnpm --filter docs generate:docs-modules

import { type ComponentType } from 'react'
import { type DocsMetadata } from '../types'

export type DocsModule = {
  default: ComponentType<Record<string, unknown>>
  metadata?: DocsMetadata
}

export type DocsImporter = () => Promise<DocsModule>

export const docsImporters: Record<string, DocsImporter> = {
  '/advanced/binding-actions.mdx': async () => await import('../mdx/advanced/binding-actions.mdx'),
  '/advanced/certified.mdx': async () => await import('../mdx/advanced/certified.mdx'),
  '/advanced/index.mdx': async () => await import('../mdx/advanced/index.mdx'),
  '/advanced/notifications.mdx': async () => await import('../mdx/advanced/notifications.mdx'),
  '/advanced/organizations.mdx': async () => await import('../mdx/advanced/organizations.mdx'),
  '/advanced/transactions.mdx': async () => await import('../mdx/advanced/transactions.mdx'),
  '/advanced/upgrades.mdx': async () => await import('../mdx/advanced/upgrades.mdx'),
  '/guides/automated-budgets.mdx': async () => await import('../mdx/guides/automated-budgets.mdx'),
  '/guides/consortium.mdx': async () => await import('../mdx/guides/consortium.mdx'),
  '/guides/corporate-registries.mdx': async () => await import('../mdx/guides/corporate-registries.mdx'),
  '/guides/draw-ai.mdx': async () => await import('../mdx/guides/draw-ai.mdx'),
  '/guides/for-profit.mdx': async () => await import('../mdx/guides/for-profit.mdx'),
  '/guides/index.mdx': async () => await import('../mdx/guides/index.mdx'),
  '/guides/non-profit.mdx': async () => await import('../mdx/guides/non-profit.mdx'),
  '/guides/tackle-corruption.mdx': async () => await import('../mdx/guides/tackle-corruption.mdx'),
  '/introduction/connect-wallet.mdx': async () => await import('../mdx/introduction/connect-wallet.mdx'),
  '/introduction/contribute.mdx': async () => await import('../mdx/introduction/contribute.mdx'),
  '/introduction/get-started.mdx': async () => await import('../mdx/introduction/get-started.mdx'),
  '/introduction/index.mdx': async () => await import('../mdx/introduction/index.mdx'),
  '/introduction/support.mdx': async () => await import('../mdx/introduction/support.mdx'),
  '/introduction/why.mdx': async () => await import('../mdx/introduction/why.mdx'),
  '/protocol/assets.mdx': async () => await import('../mdx/protocol/assets.mdx'),
  '/protocol/index.mdx': async () => await import('../mdx/protocol/index.mdx'),
  '/protocol/organigrams.mdx': async () => await import('../mdx/protocol/organigrams.mdx'),
  '/protocol/organs.mdx': async () => await import('../mdx/protocol/organs.mdx'),
  '/protocol/procedures.mdx': async () => await import('../mdx/protocol/procedures.mdx'),
  '/reference/index.mdx': async () => await import('../mdx/reference/index.mdx'),
  '/reference/js.mdx': async () => await import('../mdx/reference/js.mdx'),
  '/reference/networks.mdx': async () => await import('../mdx/reference/networks.mdx'),
  '/reference/privacy.mdx': async () => await import('../mdx/reference/privacy.mdx'),
  '/reference/react.mdx': async () => await import('../mdx/reference/react.mdx'),
  '/reference/rest-api.mdx': async () => await import('../mdx/reference/rest-api.mdx'),
  '/reference/solidity.mdx': async () => await import('../mdx/reference/solidity.mdx'),
  '/reference/terms.mdx': async () => await import('../mdx/reference/terms.mdx')
}
