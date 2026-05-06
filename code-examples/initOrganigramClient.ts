import { OrganigramClient } from '@organigram/js'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const publicClient = createPublicClient({ transport: http(process.env.ETHEREUM_PROVIDER) })
const walletClient = createWalletClient({ account: privateKeyToAccount('0xPrivateKeyExample'), transport: http(process.env.ETHEREUM_PROVIDER) })

const organigramClient = await OrganigramClient.load({ publicClient, walletClient })

export { organigramClient }
