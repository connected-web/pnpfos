import ApiClient from './client/ApiClient'
import type { ApiClientType } from './client/ApiClient'

import packageJson from '../package.json'

const { version, name } = packageJson

export type {
  ApiClientType
}

ApiClient.packageId = name
ApiClient.version = version

export default ApiClient
