async function getOAuthToken () {
  try {
    const clientId = process.env.OAUTH_CLIENT_ID ?? 'not-set'
    const clientSecret = process.env.OAUTH_CLIENT_SECRET ?? 'not-set'
    const oauthTokenEndpoint = process.env.OAUTH_TOKEN_ENDPOINT ?? 'not-set'
    if (clientId === 'not-set' || clientSecret === 'not-set' || oauthTokenEndpoint === 'not-set') {
      console.error('OAuth environment variables not set - exiting early with error code 1')
      process.exit(1)
    }

    const requestPayload = [
      'grant_type=client_credentials',
      `client_id=${clientId}`
    ].join('&')

    const requestHeaders = {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    }

    const response = await fetch(oauthTokenEndpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: requestPayload
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch token: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data?.access_token ?? 'not-set'
  } catch (err) {
    console.error('Error fetching OAuth token:', err?.message, '- exiting early with error code 2')
    process.exit(2)
  }
}

async function run() {
  const token = await getOAuthToken()
  if (token === 'not-set') {
    console.error('Failed to retrieve a valid OAuth token - exiting process with error code 3')
    process.exit(3)
  }
  return token
}

run()
  .then((token) => process.stdout.write(token))
  .catch((error) => console.error('Error:', error))