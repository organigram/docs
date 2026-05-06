import { organigramClient } from './initOrganigramClient'

const organMetadata = '' // Optional: provide a CID for the organ metadata stored on IPFS or similar
const salt = 'unique-salt-value' // Optional: provide a unique salt for deterministic address.

const newOrgan = await organigramClient.deployOrgan({
  cid: organMetadata,
  permissions: [], // Passing an empty array or no argument for permissions will create an organ with the signer as owner.
  salt
})

console.info(newOrgan)
