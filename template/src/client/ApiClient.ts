import OpenAPIClientAxios, { OpenAPIV3 } from 'openapi-client-axios'
import OpenAPIDocument from './OpenAPISpec.json'
import { Client } from './ApiClientTypes'

interface ServerInfo {
  baseURL: string
  headers: {
    [param: string]: string
  }
}

function validateStatus (status: number): boolean {
  return status >= 200 && status < 600 // default
}

/**
 * List of methods that are generated from the OpenAPI document - these can be used to check if a method is a standard Axios method or an API method
 */
const standardAxiosClientMethods = [
  'constructor',
  'request',
  '_request',
  'getUri',
  'delete',
  'get',
  'head',
  'options',
  'post',
  'postForm',
  'put',
  'putForm',
  'patch',
  'patchForm',
  'defaults',
  'interceptors',
  'create',
  'paths',
  'api'
]

export interface ApiClientType extends Client {}

export default class ApiClient {
  /**
   * Package ID matching the name in package.json - useful for reflection when logging
   */
  static packageId: string = 'template-api-client'

  /**
   * Package version matching the version in package.json - useful for reflection when logging
   */
  static version: string = '0.0.0'

  /**
   * List of methods that are generated from the OpenAPI document
   * */
  static apiMethods: string[] = []

  /**
   * Base URL for the API client to communicate with
   */
  baseURL: string

  /**
   * Helper function to get a valid access token for the API client to use
   */
  getAccessToken: () => Promise<string>

  constructor (baseURL: string, getAccessToken: () => Promise<string>) {
    if (!baseURL.includes('https://')) {
      baseURL = `https://${baseURL}`
    }
    if (typeof getAccessToken !== 'function') {
      throw new Error('Supplied getAccessToken must be a function')
    }
    this.baseURL = baseURL
    this.getAccessToken = getAccessToken
  }

  static async create (baseURL: string, getAccessToken: () => Promise<string>): Promise<ApiClientType> {
    const client = new ApiClient(baseURL, getAccessToken)
    const instance = await client.getInstance()
    ApiClient.apiMethods = Object.keys(instance).filter((method) => !standardAxiosClientMethods.includes(method))
    return instance
  }

  async getServerInfo (): Promise<ServerInfo> {
    const authToken = await this.getAccessToken()
    const server: ServerInfo = {
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    }

    return server
  }

  async getInstance (): Promise<Client> {
    const serverInfo = await this.getServerInfo()
    const client = new OpenAPIClientAxios({
      definition: OpenAPIDocument as OpenAPIV3.Document,
      axiosConfigDefaults: Object.assign({}, serverInfo, { validateStatus })
    })

    return await client.getClient<Client>()
  }
}
