import ApiClient from '../src/PackageIndex'

import { expect } from 'chai'

describe('Connected Web API Client Package', () => {
  it('should have the expected keys', () => {
    const actual = Object.keys(ApiClient)
    const expected = ['packageId', 'version', 'apiMethods']
    expect(actual).to.deep.equal(expected)
  })

  it('should return the package id', () => {
    const actual = ApiClient.packageId
    expect(actual).to.equal('@connected-web/template-package')
  })

  it('should return an array of api methods after using the create syntax', async () => {
    await ApiClient.create('https://example.com', async () => 'token')
    const actual = ApiClient.apiMethods
    expect(actual).to.contain('getStatus')
  })

  it('should support a constructable API Client', () => {
    const actual = new ApiClient('https://example.com', async () => 'token')
    expect(actual).to.be.an('object')

    const expectedMethods = ['baseURL', 'getAccessToken']
    const actualMethods = Object.keys(actual)
    expect(actualMethods).to.deep.equal(expectedMethods)
  })

  it('should support methods to getServerInfo', async () => {
    const testClient = new ApiClient('https://example.com', async () => 'token')
    const actual = await testClient.getServerInfo()

    const expectedKeys = ['baseURL', 'headers']
    const actualKeys = Object.keys(actual)
    expect(actualKeys).to.deep.equal(expectedKeys)
  })

  it('should support methods to getInstance', async () => {
    const testClient = new ApiClient('https://example.com', async () => 'token')
    const actual = await testClient.getInstance()

    const expectedKeys = ['get', 'head', 'options', 'post', 'put', 'patch', 'delete', 'paths']
    const actualKeys = Object.keys(actual)
    expect(actualKeys).to.contain.members(expectedKeys)
  })

  it('should at minimum have a GET /status path', async () => {
    const testClient = new ApiClient('https://example.com', async () => 'token')
    const actual = await testClient.getInstance()

    const expected = '/status'
    const actualPaths = actual.paths
    expect(actualPaths).to.have.property(expected)

    const actualMethods = Object.keys(actualPaths[expected])
    expect(actualMethods).to.contain('get')
  })

  it('should support a version string', () => {
    const actual = ApiClient.version
    expect(actual).to.be.a('string')
  })

  // See: https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
  // https://regex101.com/r/vkijKf/1/
  const officialSemVerRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/gm
  it('should return the version as semver', () => {
    const actual = ApiClient.version
    expect(actual).to.match(officialSemVerRegex)
  })
})
