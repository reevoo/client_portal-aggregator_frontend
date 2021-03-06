'use strict'

const constants = {
  CONSUMER: 'frontend_client_portal-aggregator',
  PACT_BROKER_URL: process.env.NODE_ENV === 'production' || process.env.TEST_ENV === 'ci'
    ? 'https://pact-broker.reevoocloud.com/'
    : 'http://localhost:7228/',
}

const config = (service) => {
  if (!service) {
    console.warn('A service name must be provided.')
    return
  }

  const serviceConfig = require('./' + service + '/config.js')
  let constantKeys = Object.keys(serviceConfig)
  constantKeys.forEach((key) => (constants[key] = serviceConfig[key]))

  return constants
}

module.exports = config
