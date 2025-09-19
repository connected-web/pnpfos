import ApiClientPackage from './@connected-web/pnpfos-ci-pipeline-test/dist/src/PackageIndex.js'
const ApiClient = ApiClientPackage?.default || ApiClientPackage

async function getAccessToken() {
  return process.env.ACCESS_TOKEN  
}

// Substitute the URL with the actual API URL
async function run() {
  const client = await ApiClient.create('https://chasm-api.dev.connected-web.services', getAccessToken)

  console.log('API version:', ApiClient.version, 'Package ID:', ApiClient.packageId)
  console.log('Available API methods:', ApiClient.apiMethods)

  const response = await client.getStatus()
  console.log('Authenticated API response:', response?.data, response?.status)
}

run()
  .then(() => console.log(''))
  .catch((error) => console.error('Error:', error))