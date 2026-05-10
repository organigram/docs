import { type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import {
  deployedAddresses,
  getChainExplorerBaseUrl,
  getConfiguredChain,
  getSupportedChainIds
} from '@organigram/js'

type DeploymentsByChain = Record<string, Record<string, string>>
export type DeploymentNetwork = { name: string; chainId: string }

export const getDeploymentNetworks = (): DeploymentNetwork[] =>
  getSupportedChainIds().map(chainId => ({
    name: getConfiguredChain(chainId)?.name ?? `Chain ${chainId}`,
    chainId
  }))

export const getNetworkLabel = (network: DeploymentNetwork): string =>
  `${network.name} (${network.chainId})`
export const getNetworkAnchor = (network: DeploymentNetwork): string =>
  `#${getNetworkLabel(network)
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')}`

export const DeploymentNetworkHeading: React.FC<{
  id: string
  children: ReactNode
}> = ({ id, children }) => (
  <Typography component='h2' variant='h2' id={id} sx={{ mt: 4, mb: 2 }}>
    {children}
  </Typography>
)

export const DeploymentNetworksTableOfContents: React.FC<{
  networks: DeploymentNetwork[]
}> = ({ networks }) => (
  <Box
    component='nav'
    aria-label='Networks'
    sx={{
      my: 3
    }}
  >
    <Box
      component='ul'
      sx={{
        display: 'grid',
        gridTemplateColumns: ['1fr', 'repeat(2, minmax(0, 1fr))'],
        gap: 1,
        m: 0,
        p: 0,
        listStyle: 'none'
      }}
    >
      {networks.map(network => (
        <Box component='li' key={network.chainId}>
          <Link
            href={getNetworkAnchor(network)}
            sx={{
              display: 'block',
              px: 1.5,
              py: 1,
              borderRadius: '8px',
              border: ({ palette }) =>
                `1px solid ${palette.grey.light2 as string}`,
              color: 'text.primary',
              fontWeight: 700,
              lineHeight: 1.3,
              textDecoration: 'none',
              transition:
                'border-color 0.1s, color 0.1s, background-color 0.1s',
              overflowWrap: 'anywhere',
              '&:hover': {
                backgroundColor: 'background.secondary',
                borderColor: 'primary.main',
                color: 'primary.main'
              }
            }}
          >
            {getNetworkLabel(network)}
          </Link>
        </Box>
      ))}
    </Box>
  </Box>
)

const DeploymentAddresses: React.FC<{ chainId: string }> = ({ chainId }) => {
  const entries = (deployedAddresses as DeploymentsByChain)[chainId]
  if (entries == null) return null

  const explorerBaseUrl = getChainExplorerBaseUrl(chainId)

  return (
    <TableContainer
      sx={{
        my: 3,
        borderRadius: '20px',
        border: ({ palette }) => `1px solid ${palette.grey.light2 as string}`,
        overflow: 'hidden'
      }}
    >
      <Table>
        <TableHead sx={{ backgroundColor: 'grey.light4' }}>
          <TableRow>
            <TableCell
              component='th'
              sx={{
                py: 1.5,
                fontSize: '0.82rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'text.disabled',
                borderColor: 'grey.light2'
              }}
            >
              Contract
            </TableCell>
            <TableCell
              component='th'
              sx={{
                py: 1.5,
                fontSize: '0.82rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'text.disabled',
                borderColor: 'grey.light2'
              }}
            >
              Address
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.entries(entries).map(([name, address]) => {
            const href =
              explorerBaseUrl == null
                ? undefined
                : `${explorerBaseUrl.replace(/\/$/, '')}/address/${address}`

            return (
              <TableRow key={name}>
                <TableCell
                  sx={{
                    py: 1.5,
                    fontSize: '0.95rem',
                    verticalAlign: 'top',
                    borderColor: 'grey.light2',
                    fontWeight: 700
                  }}
                >
                  {name}
                </TableCell>
                <TableCell
                  sx={{
                    py: 1.5,
                    fontSize: '0.95rem',
                    verticalAlign: 'top',
                    borderColor: 'grey.light2'
                  }}
                >
                  <Typography
                    component={href == null ? 'code' : Link}
                    href={href}
                    target={href == null ? undefined : '_blank'}
                    rel={href == null ? undefined : 'noopener noreferrer'}
                    sx={{
                      color: href == null ? 'text.primary' : 'primary.main',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      overflowWrap: 'anywhere',
                      textDecoration: href == null ? 'none' : 'underline',
                      textDecorationColor:
                        href == null
                          ? 'transparent'
                          : 'rgba(46, 91, 255, 0.25)',
                      textUnderlineOffset: '0.18em',
                      ':hover': {
                        textDecorationColor:
                          href == null ? 'transparent' : 'currentColor'
                      }
                    }}
                  >
                    {address}
                  </Typography>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default DeploymentAddresses
