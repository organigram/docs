import { type ReactNode } from 'react'
import Typography from '@mui/material/Typography'
import { deployedAddresses, getConfiguredChain, getSupportedChainIds } from '@organigram/js'

type DeploymentsByChain = Record<string, Record<string, string>>
export type DeploymentNetwork = { name: string; chainId: string }

export const getDeploymentNetworks = (): DeploymentNetwork[] =>
  getSupportedChainIds().map(chainId => ({
    name: getConfiguredChain(chainId, undefined, false)?.name ?? `Chain ${chainId}`,
    chainId
  }))

export const getNetworkLabel = (network: DeploymentNetwork): string => `${network.name} (${network.chainId})`
export const getNetworkAnchor = (network: DeploymentNetwork): string =>
  `#${getNetworkLabel(network).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')}`

export const DeploymentNetworkHeading: React.FC<{ id: string; children: ReactNode }> = ({ id, children }) => (
  <Typography component='h2' variant='h2' id={id} sx={{ mt: 4, mb: 2 }}>{children}</Typography>
)

const DeploymentAddresses: React.FC<{ chainId: string }> = ({ chainId }) => {
  const entries = (deployedAddresses as DeploymentsByChain)[chainId]
  if (entries == null) return null
  return <pre>{JSON.stringify(entries, null, 2)}</pre>
}

export default DeploymentAddresses
