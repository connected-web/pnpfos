# @connected-web/template-package

This is a generated API client for interacting with the Connected Web API programmatically.

See: [working-with-the-npm-registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

## Using this package

To use this package locally, you will need to create a `.npmrc` file in the root of your project with the following contents:

```
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
@connected-web:registry=https://npm.pkg.github.com
```

Then you can install the package using `npm install @connected-web/template-package`

## Example usage

```typescript
import ApiClient from '@connected-web/template-package'

async function getAccessToken() {
  return process.env.ACCESS_TOKEN  
}

// Substitute the URL with the actual API URL
async function run() {
  const client = await ApiClient.create('https://example-api.dev.connected-web.services', getAccessToken)

  console.log('API version:', ApiClient.version, 'Package ID:', ApiClient.packageId)
  console.log('Available API methods:', ApiClient.apiMethods)

  const response = await client.getStatus()
  console.log('Authenticated API response:', response?.data, response?.status)
}

run()
  .then(() => console.log(''))
  .catch((error) => console.error('Error:', error))
```

Example output:

```js
Secure API response: { status: 'ok' } 200 API version: 1.0.0 Package ID: @connected-web/template-package
```

## API Documentation

{{GENERATED_API_DOCS}}

## Sources of Access Tokens

### User Access Tokens

[Connected Web AWS Identity](https://github.com/connected-web/connected-web-aws) has a collection of AWS Cognito User Pools that can be used to authenticate users and generate access tokens.

To locate your own access token, visit the [API Explorer](https://connected-web.github.io/api-explorer/) and authenticate via the "Login" button. Once authenticated, you can copy your access token from the User Details page.

```bash
export ACCESS_TOKEN=<paste-your-token-here>
```

### Github Actions

For CI/CD pipelines, use thea combination of `client-id` and `client-secret` to request a token.

- `oauth-token-endpoint`: The OAuth token endpoint URL

  | Environment | OAuth Token Endpoint URL                                                   |
  |-------------|----------------------------------------------------------------------------|
  | DEV         | `https://connected-web-dev.auth.eu-west-2.amazoncognito.com/oauth2/token`  |
  | PROD        | `https://connected-web.auth.eu-west-2.amazoncognito.com/oauth2/token`      |

Example code:

```ts
export async function getOAuthToken (): Promise<string> {
  const { clientId, clientSecret, oauthTokenEndpoint } = clientConfig
  const requestPayload = [
    'grant_type=client_credentials',
    `client_id=${clientId}`
  ].join('&')
  const requestHeaders = {
    accept: 'application/json',
    'content-type': 'application/x-www-form-urlencoded',
    authorization: `Basic ${btoa([clientId, clientSecret].join(':'))}`
  }
  const tokenResponse = await axios.post(oauthTokenEndpoint, requestPayload, { headers: requestHeaders })
  return tokenResponse?.data?.access_token ?? 'not-set'
}
```

### AWS Lambda Functions

You can also create App-to-app clients stored in AWS Secrets Manager. These clients can be used to authenticate with the API. Simply use the AWS SDK to retrieve the client ID and secret and pass them to the API client. Alternatively, if your API is receiving requests from a browser-based UI, you can forward the user's access token when creating the API client. This is recommended for serverless functions that are invoked by a browser-based UI.

## Local development

This package is generated from an OpenAPI spec.

To make general changes visit the action and modify the template:
-  https://github.com/connected-web/pnpfos

However for any functional or interface, you will need to find the source repo for the OpenAPI spec to make changes to the API client itself, and then re-run the action to generate a new version of this package.

## Additional support

Please raise issues against https://github.com/connected-web/pnpfos/issues detailing your requirements.