import fs from 'fs'
import path from 'path'
import child_process from 'child_process'

const __dirname = path.dirname(new URL(import.meta.url).pathname)

function writeGithubOutput (name, value) {
  const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT
  const output = `${name}<<::WGHO::\n${value}\n::WGHO::\n`
  if (GITHUB_OUTPUT) {
    fs.appendFileSync(GITHUB_OUTPUT, output)
  } else {
    console.log(`[local-output] ${name} = ${value}`)
  }
}

const cwd = process.cwd()
function relativePath (file, cwd) {
  if (!cwd) {
    cwd = __dirname
  }
  return path.join(cwd, file)
}

export async function getOAuthToken () {
  if (process.env.API_ACCESS_TOKEN) {
    return process.env.API_ACCESS_TOKEN
  }
  
  try {
    const clientId = process.env.OAUTH_CLIENT_ID ?? 'not-set'
    const clientSecret = process.env.OAUTH_CLIENT_SECRET ?? 'not-set'
    const oauthTokenEndpoint = process.env.OAUTH_TOKEN_ENDPOINT ?? 'not-set'
    if (clientId === 'not-set' || clientSecret === 'not-set' || oauthTokenEndpoint === 'not-set') {
      console.error('OAuth environment variables not set - exiting early')
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
    console.error('Error fetching OAuth token:', err?.message)
    return 'not-set'
  }
}

const SIXTY_SECOND_TIMEOUT = 60 * 1000
const FIVE_MINUTE_TIMEOUT = 10 * 60 * 1000

async function runCommand (command, timeout = SIXTY_SECOND_TIMEOUT, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    let timeoutId = 0
    const child = child_process.spawn(command, { shell: true, cwd })
    child.stdout.on('data', data => console.log('[*]', data.toString()))
    child.stderr.on('data', data => console.error('[*]', data.toString()))
    child.on('exit', code => {
      clearTimeout(timeoutId)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with code ${code} for: ${command}`))
      }
    })
    timeoutId = setTimeout(() => {
      child.kill()
      console.error('Command timed out', { command, timeout })
      reject(new Error('Command timed out'))
    }, timeout)
  })
}

class Logger {
  constructor (name) {
    this.name = name
  }
  get prefix () {
    return `[${this.name}]`
  }
  log (...args) {
    console.log(this.prefix, ...args)
  }
  info (...args) {
    console.info(this.prefix, ...args)
  }
  error (...args) {
    console.error(this.prefix, ...args)
  }
}
const logger = new Logger('pnpfos-action')

function readWithDefault (value, defaultValue) {
  const emptyOrUndefined = value === undefined || String(value).trim().length === 0
  return emptyOrUndefined ? defaultValue : value
}

function sanitizeVersion (version) {
  return version.replace(/\//g, '-')
}

async function resolveAccessToken (openapiSpecUrl) {
  if (openapiSpecUrl && openapiSpecUrl !== 'no-openapi-spec-url') {
    logger.info('🔐 Fetching OAuth token for accessing OpenAPI spec URL')
    return getOAuthToken()
  }
  return null
}

async function readParamsFromEnv (env) {
  const packageId = readWithDefault(env.PACKAGE_ID, 'no-package-id')
  const openapiSpecFile = readWithDefault(env.OPENAPI_SPEC_FILE, 'no-openapi-spec-file')
  const openapiSpecUrl = readWithDefault(env.OPENAPI_SPEC_URL, 'no-openapi-spec-url')
  const version = sanitizeVersion(readWithDefault(env.VERSION, 'no-version'))
  const previewMode = readWithDefault(env.PREVIEW_MODE, 'false').toLowerCase() === 'true'
  const sourceRepoId = readWithDefault(env.SOURCE_REPO_ID, 'no-source-repo-id')

  const accessToken = await resolveAccessToken(openapiSpecUrl)

  return {
    packageId,
    openapiSpecFile,
    openapiSpecUrl,
    version,
    previewMode,
    sourceRepoId,
    standardAuthHeaders: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  }
}

function readOpenAPISpecFromFile (file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (err) {
    logger.error('Error reading OpenAPI spec file:', err.message)
    return false
  }
}

async function readOpenAPISpecFromUrl (url, standardAuthHeaders) {
  try {
    const res = await fetch(url, { method: 'GET', headers: standardAuthHeaders })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }
    return res.text()
  } catch (err) {
    logger.error('Error reading OpenAPI spec URL:', err.message)
    return false
  }
}

function validateOpenAPISpec (spec) {
  try {
    JSON.parse(spec)
    return true
  } catch (err) {
    logger.error('Error parsing OpenAPI spec:', err.message)
    return false
  }
}

const validPackageIdRegex = /^@connected-web\/[a-z0-9-]+$/
function validatePackageId (packageId) {
  return validPackageIdRegex.test(packageId)
}

async function searchAndReplaceInFiles (dirPath, search, replace) {
  const files = fs.readdirSync(dirPath)
  for (const file of files) {
    const filePath = path.join(dirPath, file)
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      await searchAndReplaceInFiles(filePath, search, replace)
    } else if (stat.isFile()) {
      const content = fs.readFileSync(filePath, 'utf8')
      const newContent = content.replaceAll(search, replace)
      fs.writeFileSync(filePath, newContent, 'utf8')
    }
  }
}

async function listFilesRelativeToDir (dirPath, ignoreNodeModules = true, level = 0, originalDirPath = dirPath) {
  const files = fs.readdirSync(dirPath)
  if (level === 0) {
    console.log('Contents of:', dirPath)
  }
  for (const file of files) {
    if (ignoreNodeModules && file === 'node_modules') {
      continue
    }
    const filePath = path.join(dirPath, file)
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      await listFilesRelativeToDir(filePath, ignoreNodeModules, level + 1, originalDirPath)
    } else if (stat.isFile()) {
      const tabs = '  '.repeat(level)
      console.log(tabs, filePath.replace(originalDirPath, ''))
    }
  }
}

function generateMarkDownForOpenAPISpec (openApiSpec, sourceRepoId) {
  const markdown = []
  markdown.push(`For more information about this API please visit the [${sourceRepoId}](https://github.com/${sourceRepoId}) repository.`)
  markdown.push('')
  markdown.push('| METHOD | PATH | Operation | Parameters |')
  markdown.push('|--------|------|-----------|------------|')

  const optionsToIgnore = ['options', 'head', 'trace']
  const spec = JSON.parse(openApiSpec)
  const paths = spec.paths

  for (const path in paths) {
    const methods = paths[path]
    for (const method in methods) {
      if (optionsToIgnore.includes(method.toLowerCase())) {
        continue
      }
      const { operationId, parameters } = methods[method]
      const summary = parameters?.map(param =>
        param.required ? `**${param.name}**` : `*${param.name}*`
      ).join(', ')
      markdown.push(`| ${String(method).toUpperCase()} | ${path} | ${operationId} | ${String(summary ?? '-')} |`)
    }
  }

  markdown.push('')
  markdown.push('**Required parameter** / *Optional parameter*')
  markdown.push('')
  return markdown.join('\n')
}

const timeStart = Date.now()
async function run () {
  const { packageId, openapiSpecFile, openapiSpecUrl, version, previewMode, standardAuthHeaders, sourceRepoId } = await readParamsFromEnv(process.env)
  logger.log('Running action... with properties:', { packageId, openapiSpecFile, openapiSpecUrl, version })

  if (previewMode) {
    logger.info('Running in preview mode')
  }

  if (!validatePackageId(packageId)) {
    logger.error('Invalid package ID - exiting early', 'Package ID:', packageId, 'should match regex:', validPackageIdRegex)
    process.exit(1)
  }

  let openapiSpec
  if (openapiSpecFile !== 'no-openapi-spec-file') {
    logger.info('Reading OpenAPI spec from file:', openapiSpecFile)
    openapiSpec = readOpenAPISpecFromFile(openapiSpecFile)
    if (!openapiSpec) {
      logger.error('Unable to load OpenAPI spec from file - exiting early')
      process.exit(1)
    }
    logger.info('OpenAPI spec loaded:', openapiSpec?.length + ' bytes')
  }

  if (openapiSpecUrl !== 'no-openapi-spec-url') {
    logger.info('Fetching OpenAPI spec from URL:', openapiSpecUrl)
    openapiSpec = await readOpenAPISpecFromUrl(openapiSpecUrl, standardAuthHeaders)
    logger.info('Auth Headers used:', standardAuthHeaders)
    if (!openapiSpec) {
      logger.error('Unable to download OpenAPI spec from URL - exiting early')
      process.exit(1)
    }
    logger.info('OpenAPI spec downloaded:', openapiSpec?.length + ' bytes')
    logger.info('OpenAPI spec (first 500 chars):\n' + openapiSpec.slice(0, 500))
    if (openapiSpec.includes('{ "message": "Unauthorized" }')) {
      logger.error('OpenAPI spec contains unauthorized message - exiting early')
      process.exit(1)
    }
  }

  if (!validateOpenAPISpec(openapiSpec)) {
    logger.error('Invalid OpenAPI spec - exiting early')
    process.exit(1)
  }

  const templateDir = relativePath('template', __dirname)
  const packageDir = relativePath(packageId, cwd)
  logger.info('Creating temporary directory:', { tmpDir: packageDir })
  await runCommand(`mkdir -p ${packageDir}`)
  logger.info('Temporary directory created successfully')

  logger.info('Copying template to temporary directory', { templateDir, tmpDir: packageDir })
  await runCommand(`cp -r ${templateDir}/* ${packageDir}`)
  logger.info('Template copied successfully')

  logger.info('Contents of package directory')
  await listFilesRelativeToDir(packageDir)

  const openapiSpecFilepath = relativePath('src/client/OpenAPISpec.json', packageDir)
  logger.info('Replacing OpenAPI spec in template folder', { openapiSpecFilepath, tmpDir: packageDir })
  fs.writeFileSync(openapiSpecFilepath, openapiSpec, 'utf8')
  logger.info('OpenAPI spec replaced successfully')

  logger.info('Replacing package name in all files')
  await searchAndReplaceInFiles(packageDir, '@connected-web/template-package', packageId)
  await searchAndReplaceInFiles(packageDir, 'connected-web/template-package', sourceRepoId)
  logger.info('Package name replaced successfully', { packageId })

  const markdown = generateMarkDownForOpenAPISpec(openapiSpec, sourceRepoId)
  const markdownFilepath = relativePath('README.md', packageDir)
  logger.info('Replacing markdown in README.md')
  const existingMarkdown = fs.readFileSync(markdownFilepath, 'utf8')
  const newMarkdown = existingMarkdown.replace('{{GENERATED_API_DOCS}}', markdown)
  fs.writeFileSync(markdownFilepath, newMarkdown, 'utf8')

  logger.info('Replacing version in package.json')
  const packageJsonFilepath = relativePath('package.json', packageDir)
  const packageJson = JSON.parse(fs.readFileSync(packageJsonFilepath, 'utf8'))
  fs.writeFileSync(packageJsonFilepath, JSON.stringify({ ...packageJson, version }, null, 2), 'utf8')
  logger.info('Version replaced successfully', { version })

  logger.info('Installing dependencies')
  await runCommand('npm install', FIVE_MINUTE_TIMEOUT, packageDir)
  logger.info('Dependencies installed successfully')

  logger.info('Running generator script')
  await runCommand('npm run typegen', FIVE_MINUTE_TIMEOUT, packageDir)
  logger.info('Generator script completed successfully')

  logger.info('Lint generated code')
  await runCommand('npm run lint:fix', FIVE_MINUTE_TIMEOUT, packageDir)
  logger.info('Code linted successfully')

  logger.info('Running tests')
  await runCommand('npm run test', FIVE_MINUTE_TIMEOUT, packageDir)
  logger.info('Tests passed successfully')

  logger.info('Building package')
  await runCommand('npm run build', FIVE_MINUTE_TIMEOUT, packageDir)
  logger.info('Package built successfully')

  const apiClientTypesSrc = relativePath('src/client/ApiClientTypes.d.ts', packageDir)
  const apiClientTypesDest = relativePath('dist/src/client/ApiClientTypes.d.ts', packageDir)
  logger.info('Copying ApiClientTypes.d.ts to dist folder')
  await runCommand(`cp ${apiClientTypesSrc} ${apiClientTypesDest}`, FIVE_MINUTE_TIMEOUT, packageDir)
  logger.info('ApiClientTypes.d.ts copied successfully')

  logger.info('Contents of dist directory')
  await listFilesRelativeToDir(packageDir)

  logger.info('Writing outputs for Github Actions', { packageId, version })
  writeGithubOutput('package-id', packageId)
  writeGithubOutput('published-version', version)

  if (previewMode) {
    logger.info('Preview mode completed successfully - package ready for publishing')
    return true
  } else {
    logger.info('Publishing package')
    const tagOption = version.indexOf('0.0.0') === 0 ? '--tag dev' : '--tag latest'
    await runCommand(`npm publish ${tagOption}`, FIVE_MINUTE_TIMEOUT, packageDir)
    logger.info(`Package published successfully with ${tagOption}`)
    return true
  }
}

run()
  .then(result => {
    const timeEnd = Date.now()
    if (result === true) {
      logger.log('Action completed', 'Duration:', Number((timeEnd - timeStart) / 1000).toFixed(2), 's')
    } else {
      logger.error('Action failed')
      process.exit(1)
    }
  })
  .catch(err => {
    logger.error('Action error:', err?.message)
    process.exit(2)
  })
