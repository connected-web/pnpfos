import ApiClient, { ApiClientType } from './@connected-web/pnpfos-ci-pipeline-test'

async function getAccessToken(): Promise<string> {
  return String(process.env.API_ACCESS_TOKEN)
}

// Substitute the URL with the actual API URL
async function run() {
  const client: ApiClientType = await ApiClient.create('https://chasm-api.dev.connected-web.services', getAccessToken)

  console.log('API version:', ApiClient.version, 'Package ID:', ApiClient.packageId)
  console.log('Available API methods:', ApiClient.apiMethods)

  const response = await client.getStatus()
  console.log('Authenticated API response:', response?.data, response?.status)
}

run()
  .then(() => console.log(''))
  .catch((error) => console.error('Error:', error))