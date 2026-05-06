import { createRandom32BytesHexId } from '@organigram/js'
import { organigramClient } from './initOrganigramClient'

const typeName = 'nomination'
const deciders = '0x1234AdressFromSomeOrgan'
const salt = createRandom32BytesHexId() // Creates a correctly formatted random salt

const newProcedure = await organigramClient.deployProcedure({
  typeName,
  deciders,
  salt
})

console.info(newProcedure)
