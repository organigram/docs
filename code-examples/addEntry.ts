import { Organ, type ContractClients } from '@organigram/js'
import { createPublicClient, createWalletClient, http } from 'viem'
import { mnemonicToAccount } from 'viem/accounts'

const myOrganAddress = '0x1234'
const publicClient = createPublicClient({
  transport: http(process.env.ETHEREUM_PROVIDER)
})
const account = mnemonicToAccount(process.env.MNEMONIC as string)
const walletClient = createWalletClient({
  account,
  transport: http(process.env.ETHEREUM_PROVIDER)
})
const clients: ContractClients = { publicClient, walletClient }

const organ = await Organ.load(myOrganAddress, clients)

const receipt = await organ.addEntries([{ address: '0x1234', cid: 'ba1234' }])

console.info(receipt)
