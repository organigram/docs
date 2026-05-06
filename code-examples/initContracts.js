/* eslint-disable no-undef */
const CoreLibrary = artifacts.require('CoreLibrary')
const OrganLibrary = artifacts.require('OrganLibrary')
const Organigram = artifacts.require('Organigram')
const Organ = artifacts.require('Organ')

module.exports = async (deployer, network, accounts) => {
  const from = accounts[0]

  /**
   *  Linking libraries.
   */
  await Organigram.link(CoreLibrary)
  await Organigram.link(OrganLibrary)
  await Organ.link(CoreLibrary)
  await Organ.link(OrganLibrary)

  /**
   *  Configure Organigram contract.
   */
  const organigram = await deployer.deploy(
    Organigram,
    '',
    '0x1234', // Gas Station Forwarder
    { from }
  )
  console.info('Organigram contract', organigram.address)
  const procedures = await organigram.proceduresRegistry()
  console.info('Procedures registry', procedures)
  const proceduresRegistry = await Organ.at(procedures)
  console.info('Procedures registered', proceduresRegistry)
}
