# pnpfos

## publish npm package from openapi spec

This is a reusable Github Action to create and publish an npm package for API Clients based an Open API spec.

## Goal

Publish npm packages based on the following info:
- Package ID: e.g. @connected-web/my-api-client
- Filepath or URL for OpenAPISpec.json
- Version: Release tag, Sem-ver 0.5.0, 1.2.3, 4.5.4, 1.2.4-RC1 etc.

This enables the following CI workflows:

- Trigger on PR - publish a release candidate with current date/time
- Trigger on Release/Prerelease tag - use the tag

## Development roadmap

### Core features
- 🤔 A reusable Github Action that...
- 🚧 Downloads / validate a provided OpenAPISpec
- 🚧 Generates TypeScript types from the OpenAPISpec
- 🚧 Fills in the package template
- 🚧 Uses a standard wrapper for creating a client
- 🚧 Runs sanity checks against the client, e.g. use OAuth token to access status endpoint
- 🚧 Publish package using inputs

### Additional tasks
- 🚧 Document parameters for Github Action in this README
- 🚧 Create a sample OpenAPISpec.json 
- 🚧 Create CI pipeline to test reusable action

## Inputs

The action should support the following inputs:

### github-token

- **Description**: GitHub token to use with `npm publish` to publish the package to the GitHub registry
- **Required**: Yes

### client-id

- **Description**: OAuth client ID used to fetch the OpenAPI spec from a URL
- **Required**: Yes if using openapi-spec-url

### client-secret

- **Description**: OAuth client secret used to fetch the OpenAPI spec from a URL
- **Required**: Yes if using openapi-spec-url

### oauth-token-endpoint

- **Description**: OAuth token endpoint used to fetch an access token for fetching the OpenAPI spec from a URL
- **Required**: Yes if using openapi-spec-url

### package-id

- **Description**: ID of the package to publish - should explicitly include @connected-web/ prefix otherwise the action will exit early
- **Required**: Yes

### openapi-spec-file

- **Description**: Path to the OpenAPI spec file to use for generating the package
- **Required**: Yes

### openapi-spec-url

- **Description**: URL to the OpenAPI spec file to use for generating the package - uses the bearer-token prop to fetch the spec
- **Required**: Yes

### version

- **Description**: Version of the package to publish - should be a valid semver version. For branches other than main, this should be a pre-release version
- **Required**: Yes

### preview-mode

- **Description**: Whether to hold off on publishing the package to the registry. If true, the package will be built and tested but not published to the registry
- **Default**: false
- **Required**: No

## How to use

To use this action, you can add the following to your workflow file:

```yaml
name: Publish API Client

on:
  pull_request:
    branches:
      - main
  release:
    types:
      - released
      - prereleased

permissions:
  contents: read
  packages: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Determine version
        id: version
        run: |
          if [ -n "${{ github.event.pull_request }}" ]; then
            echo "Using 0.0.0-branch+gitref as the version for a PR"
            echo "version=0.0.0-${{ github.head_ref }}-${{ github.sha }}" >> $GITHUB_OUTPUT
          elif [ "${{ github.event.release.prerelease }}" == "true" ]; then
            echo "Using the tag name for prerelease"
            echo "version=${{ github.event.release.tag_name }}-RC${{ github.run_number }}" >> $GITHUB_OUTPUT
          else
            echo "Using the tag name for release"
            echo "version=${{ github.event.release.tag_name }}" >> $GITHUB_OUTPUT
          fi
        shell: bash

      - name: Publish API Client
        uses: connected-web/pnpfos@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          bearer-token: ${{ secrets.APPS_COGNITO_BEARER_UAT }}
          package-id: '@connected-web/my-api-client'
          # openapi-spec-file: 'src/post-deployment/openapi-spec.json'
          openapi-spec-url: 'https://my-api.dev.connected-web.services/openapi'
          version: ${{ steps.version.outputs.version }}
```