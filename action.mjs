import fs from 'fs'
import path from 'path'
import child_process from 'child_process'

const __dirname = path.dirname(new URL(import.meta.url).pathname)

function writeGithubOutput (name, value) {
  const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT
  const output = `${name}<<::WGHO::\n${value}\n::WGHO::\n`
  fs.appendFileSync(GITHUB_OUTPUT, output)
}

const cwd = process.cwd()
function relativePath (file, cwd) {
  if (!cwd) {
    cwd = __dirname
  }
  return path.join(cwd, file)
}

// Spawn a child process
// Directly log its output
// Return a promise that resolves when the process exits
// Timeout after 1 minute

const SIXTY_SECOND_TIMEOUT = 60 * 1000
const FIVE_MINUTE_TIMEOUT = 10 * 60 * 1000

/**
 * Run a command in a child process
 * 
 * - Logs stdout and stderr to the console
 * - Rejects the promise if the process exits with a non-zero code
 * - Resolves the promise if the process exits with a zero code
 * - Rejects the promise if the process takes longer than 60 seconds
 * 
 * @param {*} command 
 * @returns  A promise that resolves when the process exits
 */
async function runCommand(command, timeout=SIXTY_SECOND_TIMEOUT, cwd=process.cwd()) {
  return new Promise((resolve, reject) => {
    let timeoutId = 0
    const child = child_process.spawn(command, { shell: true, cwd })
    child.stdout.on('data', data => console.log('[*]', data.toString()))
    child.stderr.on('data', data => console.error('[*]', data.toString()))
    child.on('exit', code => {
      clearTimeout(timeoutId)
      if (code === 0) {
        // console.log('Command completed successfully', { command, code })
        resolve()
      } else {
        // console.error(`Command failed with code ${code}`, { command, code })
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
  get prefix() {
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
  // replace / from branch names with -
  return version.replace(/\//g, '-')
}

function readParamsFromEnv(env) {
  const { ACCESS_TOKEN, PACKAGE_ID, OPENAPI_SPEC_FILE, OPENAPI_SPEC_URL, VERSION, PREVIEW_MODE, SOURCE_REPO_ID } = env
  const accessToken = readWithDefault(ACCESS_TOKEN, 'no-access-token')
  return {
    accessToken,
    packageId: readWithDefault(PACKAGE_ID, 'no-package-id'),
    openapiSpecFile: readWithDefault(OPENAPI_SPEC_FILE, 'no-openapi-spec-file'),
    openapiSpecUrl: readWithDefault(OPENAPI_SPEC_URL, 'no-openapi-spec-url'),
    version: sanitizeVersion(readWithDefault(VERSION , 'no-version')),
    previewMode: readWithDefault(PREVIEW_MODE, 'false').toLowerCase() === 'true',
    standardAuthHeaders: {
      Authorization: `Bearer ${accessToken}`
    },
    sourceRepoId: readWithDefault(SOURCE_REPO_ID, 'no-source-repo-id')
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
    return fetch(url, {
      method: 'GET',
      headers: standardAuthHeaders,
    }).then(res => res.text())
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
  // Should always begin with @connected-web/ and contain only lowercase letters, numbers, and hyphens
  return validPackageIdRegex.test(packageId)
}

async function searchAndReplaceInFiles(dirPath, search, replace) {
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

async function listFilesRelativeToDir (dirPath, ignoreNodeModules=true, level=0, originalDirPath=dirPath) {
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


// Create a markdown table containing METHOD, PATH, MethodName, and Description from OpenAPI spec
function generateMarkDownForOpenAPISpec(openApiSpec, sourceRepoId) {
  const markdown = []

  // Add info about the source repo
  markdown.push(`For more information about this API please visit the [${sourceRepoId}](https://github.com/${sourceRepoId}) repository.`)
  markdown.push('')

  // Feature request: Instead of a table use headings and code blocks for each endpoint

  // Add headings
  markdown.push('| METHOD | PATH | Operation | Parameters |')
  markdown.push('|--------|------|-----------|------------|')

  // Ignore options, head, and trace methods
  const optionsToIgnore = ['options', 'head', 'trace']

  const spec = JSON.parse(openApiSpec)
  const paths = spec.paths
  for (const path in paths) {
    const methods = paths[path]
    for (const method in methods) {
      const { operationId, parameters } = methods[method]
      // Make summary out of parameters
      const summary = parameters?.map(param => {
        return param.required ? `**${param.name}**` : `*${param.name}*`
      }).join(', ')
      if (optionsToIgnore.includes(method.toLowerCase())) {
        continue
      }
      markdown.push(`| ${String(method).toUpperCase()} | ${path} | ${operationId} | ${String(summary ?? '-')} |`)
    }
  }

  markdown.push('')
  markdown.push(`**Required parameter** / *Optional parameter*`)
  markdown.push('')

  return markdown.join('\n')
}

const timeStart = Date.now()
async function run () {
  const { accessToken, packageId, openapiSpecFile, openapiSpecUrl, version, previewMode, standardAuthHeaders, sourceRepoId } = readParamsFromEnv(process.env)
  logger.log('Running action... with properties:', {
    accessToken: accessToken?.length + ' bytes',
    packageId,
    openapiSpecFile,
    openapiSpecUrl,
    version
  })

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
    if (openapiSpec) {
      logger.info('OpenAPI spec loaded:', openapiSpec?.length + ' bytes')
    } else {
      logger.error('Unable to load OpenAPI spec from file - exiting early')
      process.exit(1)
    }
  }

  if (openapiSpecUrl !== 'no-openapi-spec-url') {
    logger.info('Fetching OpenAPI spec from URL:', openapiSpecUrl)
    openapiSpec = await readOpenAPISpecFromUrl(openapiSpecUrl, standardAuthHeaders)
    if (openapiSpec) {
      logger.info('OpenAPI spec downloaded:', openapiSpec?.length + ' bytes')
      // 👇 add this
      logger.info('OpenAPI spec (first 500 chars):\n' + openapiSpec.slice(0, 500))
    } else {
      logger.error('Unable to download OpenAPI spec from URL - exiting early')
      process.exit(1)
    }
  }

  if (!validateOpenAPISpec(openapiSpec)) {
    logger.error('Invalid OpenAPI spec - exiting early')
    process.exit(1)
  }

  // Make a temporary directory
  const templateDir = relativePath('template', __dirname)
  const packageDir = relativePath(packageId, cwd)
  logger.info('Creating temporary directory:', { tmpDir: packageDir })
  await runCommand(`mkdir -p ${packageDir}`)
  logger.info('Temporary directory created successfully')  

  // Copy template
  logger.info('Copying template to temporary directory', { templateDir, tmpDir: packageDir })
  await runCommand(`cp -r ${templateDir}/* ${packageDir}`)
  logger.info('Template copied successfully')

  // List folder tree for temporary directory
  logger.info('Contents of package directory')
  await listFilesRelativeToDir(packageDir)

  // Replace OpenAPI spec in template folder
  const openapiSpecFilepath = relativePath('src/client/OpenAPISpec.json', packageDir)
  logger.info('Replacing OpenAPI spec in template folder', { openapiSpecFilepath, tmpDir: packageDir })
  fs.writeFileSync(openapiSpecFilepath, openapiSpec, 'utf8')
  logger.info('OpenAPI spec replaced successfully')

  // Search and replace template-package across all files
  logger.info('Replacing package name in all files')
  await searchAndReplaceInFiles(packageDir, '@connected-web/template-package', packageId)
  await searchAndReplaceInFiles(packageDir, 'connected-web/template-package', sourceRepoId)
  logger.info('Package name replaced successfully', { packageId })

  // Generate markdown from OpenAPI spec - search and replace in README.md
  const markdown = generateMarkDownForOpenAPISpec(openapiSpec, sourceRepoId)
  const markdownFilepath = relativePath('README.md', packageDir)
  logger.info('Replacing markdown in README.md')
  const existingMarkdown = fs.readFileSync(markdownFilepath, 'utf8')
  const newMarkdown = existingMarkdown.replace('{{GENERATED_API_DOCS}}', markdown)
  fs.writeFileSync(markdownFilepath, newMarkdown, 'utf8')

  // Replace version in package.json
  logger.info('Replacing version in package.json')
  const packageJsonFilepath = relativePath('package.json', packageDir)
  const packageJson = JSON.parse(fs.readFileSync(packageJsonFilepath, 'utf8'))
  fs.writeFileSync(packageJsonFilepath, JSON.stringify({ ...packageJson, version }, null, 2), 'utf8')
  logger.info('Version replaced successfully', { version })

  // Install dependencies (consider handing this off to Github Actions)
  logger.info('Installing dependencies')
  await runCommand(`npm install`, FIVE_MINUTE_TIMEOUT, packageDir)
  logger.info('Dependencies installed successfully')

  // Run generator script
  logger.info('Running generator script')
  await runCommand(`npm run typegen`, FIVE_MINUTE_TIMEOUT, packageDir)
  logger.info('Generator script completed successfully')

  // Lint generated code
  logger.info('Lint generated code')
  await runCommand(`npm run lint:fix`, FIVE_MINUTE_TIMEOUT, packageDir)
  logger.info('Code linted successfully')

  // Run tests (consider handing this off to Github Actions)
  logger.info('Running tests')
  await runCommand(`npm run test`, FIVE_MINUTE_TIMEOUT, packageDir)
  logger.info('Tests passed successfully')

  // Build package (consider handing this off to Github Actions)
  logger.info('Building package')
  await runCommand(`npm run build`, FIVE_MINUTE_TIMEOUT, packageDir)
  logger.info('Package built successfully')
  
  // Manually copy ApiClientTypes.d.ts to dist folder
  const apiClientTypesSrc = relativePath('src/client/ApiClientTypes.d.ts', packageDir)
  const apiClientTypesDest = relativePath('dist/src/client/ApiClientTypes.d.ts', packageDir)
  logger.info('Copying ApiClientTypes.d.ts to dist folder')
  await runCommand(`cp ${apiClientTypesSrc} ${apiClientTypesDest}`, FIVE_MINUTE_TIMEOUT, packageDir)
  logger.info('ApiClientTypes.d.ts copied successfully')

  // List resulting folder tree for dist directory
  logger.info('Contents of dist directory')
  await listFilesRelativeToDir(packageDir)

  // Write outputs for Github Actions
  logger.info('Writing outputs for Github Actions', { packageId, version })
  writeGithubOutput('package-id', packageId)
  writeGithubOutput('published-version', version)
  
  if (previewMode) {
    logger.info('Preview mode completed successfully - package ready for publishing')
    // Skip publishing in preview mode
    return true
  } else {
    // Publish package
    logger.info('Publishing package')
    const tagOption = version.indexOf('0.0.0') === 0 ? '--tag dev' : '--tag latest'
    await runCommand(`npm publish ${tagOption}`, FIVE_MINUTE_TIMEOUT, packageDir)
    logger.info(`Package published successfully with ${tagOption}`)
    return true
  }
}

run()
  .then((result) => {
    const timeEnd = Date.now()
    if (result === true) {
      logger.log('Action completed', 'Duration:', Number((timeEnd - timeStart) / 1000).toFixed(2), 's')
    } else {
      logger.error('Action failed')
      process.exit(1)
    }
  }).catch((err) => {
    logger.error('Action error:', err?.message)
    process.exit(2)
  })
