import { createHash, randomBytes } from 'node:crypto'
import { promises as dns } from 'node:dns'
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const toolsDir = join(projectRoot, 'tools')
const logDir = join(projectRoot, 'qa', 'preview')
const cloudflaredPath = join(toolsDir, 'cloudflared.exe')
const urlPath = join(projectRoot, 'CURRENT_PREVIEW_URL.txt')
const statePath = join(projectRoot, '.gilar-preview-state.json')
const apiPort = 8787
const webPort = 5175
const localWebUrl = `http://127.0.0.1:${webPort}`
const lanWebUrl = detectLanUrl()
const webBindHost = lanWebUrl ? '0.0.0.0' : '127.0.0.1'
const cloudflaredReleaseApi = 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest'

let stopping = false
const children = []
const expectedStops = new Set()

function log(message) { process.stdout.write(`[Gilar Preview] ${message}\n`) }

function safeEnvironment(overrides) {
  const environment = { ...process.env }
  for (const key of Object.keys(environment)) {
    if (/SECRET|TOKEN|PASSWORD|DATABASE|INTUIT|API_KEY|CREDENTIAL|AUTH|VERCEL|RAILWAY|RENDER/i.test(key)) delete environment[key]
  }
  return { ...environment, ...overrides }
}

function ensureDirectories() {
  mkdirSync(toolsDir, { recursive: true })
  mkdirSync(logDir, { recursive: true })
}

function detectLanUrl() {
  const candidates = []
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      const isIpv4 = address.family === 'IPv4' || address.family === 4
      const isPrivate = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address)
      if (isIpv4 && !address.internal && isPrivate) candidates.push(address.address)
    }
  }
  return candidates[0] ? `http://${candidates[0]}:${webPort}` : undefined
}

function writePreviewUrls({ publicUrl = '', publicStatus = 'starting' } = {}) {
  if (stopping) return
  const lines = [`LOCAL: ${localWebUrl}`]
  if (lanWebUrl) lines.push(`LAN: ${lanWebUrl}`)
  lines.push(`PUBLIC: ${publicUrl || (publicStatus === 'unavailable' ? 'UNAVAILABLE' : 'STARTING')}`)
  lines.push(`PUBLIC STATUS: ${publicStatus}`)
  writeFileSync(urlPath, `${lines.join('\n')}\n`)
}

function localBinaryIsUsable() {
  try { return existsSync(cloudflaredPath) && readFileSync(cloudflaredPath).byteLength > 5_000_000 } catch { return false }
}

async function downloadCloudflared() {
  if (localBinaryIsUsable()) {
    log('Using the project-local cloudflared binary.')
    return
  }

  log('Downloading the official Cloudflare cloudflared binary...')
  const releaseResponse = await fetch(cloudflaredReleaseApi, { headers: { 'User-Agent': 'Gilar-Preview-Launcher' } })
  if (!releaseResponse.ok) throw new Error(`Cloudflare release lookup failed (${releaseResponse.status}).`)
  const release = await releaseResponse.json()
  const asset = release.assets?.find((item) => item.name === 'cloudflared-windows-amd64.exe')
  if (!asset?.browser_download_url) throw new Error('The official Windows cloudflared asset was not found.')
  const checksumLine = String(release.body ?? '').split(/\r?\n/).find((line) => line.trim().startsWith(`${asset.name}:`))
  const expectedChecksum = checksumLine?.match(/([a-f0-9]{64})\s*$/i)?.[1]?.toLowerCase()
  if (!expectedChecksum) throw new Error('The official Cloudflare release did not include a verifiable SHA-256 checksum.')

  const binaryResponse = await fetch(asset.browser_download_url, { redirect: 'follow' })
  if (!binaryResponse.ok) throw new Error(`Cloudflare binary download failed (${binaryResponse.status}).`)
  const binary = Buffer.from(await binaryResponse.arrayBuffer())
  const actualChecksum = createHash('sha256').update(binary).digest('hex')
  if (actualChecksum !== expectedChecksum) throw new Error('The downloaded cloudflared checksum did not match the official release checksum.')

  const temporaryPath = `${cloudflaredPath}.download`
  writeFileSync(temporaryPath, binary)
  rmSync(cloudflaredPath, { force: true })
  writeFileSync(cloudflaredPath, binary)
  rmSync(temporaryPath, { force: true })
  log(`Saved verified cloudflared ${release.tag_name ?? 'latest'} in the project tools folder.`)
}

function startProcess(label, command, args, environment, logFileName, showOutput = true) {
  const logPath = join(logDir, logFileName)
  rmSync(logPath, { force: true })
  const logStream = createWriteStream(logPath, { flags: 'w' })
  const isWindowsCommand = command.toLowerCase().endsWith('.cmd')
  const executable = isWindowsCommand ? (process.env.ComSpec ?? 'cmd.exe') : command
  const childArgs = isWindowsCommand ? ['/d', '/s', '/c', command, ...args] : args
  const child = spawn(executable, childArgs, {
    cwd: projectRoot,
    env: environment,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const writeOutput = (chunk) => {
    const text = String(chunk)
    logStream.write(text)
    if (showOutput) process.stdout.write(`[${label}] ${text}`)
  }
  child.stdout?.on('data', writeOutput)
  child.stderr?.on('data', writeOutput)
  child.on('error', (error) => {
    if (!stopping) log(`${label} process error: ${error.message}`)
  })
  child.on('exit', (code, signal) => {
    logStream.end()
    if (!stopping && !expectedStops.has(child) && code !== 0) log(`${label} stopped unexpectedly (code ${code ?? 'none'}, signal ${signal ?? 'none'}).`)
  })
  children.push({ label, child, logStream })
  return child
}

async function waitForHttp(url, label, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs
  let lastError = 'not responding yet'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) })
      if (response.ok) { log(`${label} is healthy.`); return }
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
  }
  throw new Error(`${label} did not become healthy: ${lastError}`)
}

async function waitForTunnelUrl(tunnel, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs
  const tunnelLogPath = join(logDir, tunnel.logFileName)
  while (Date.now() < deadline) {
    if (existsSync(tunnelLogPath)) {
      const tunnelUrl = readFileSync(tunnelLogPath, 'utf8').match(tunnel.urlPattern)?.[0]
      if (tunnelUrl) return tunnelUrl
    }
    if (tunnel.child.exitCode !== null) throw new Error(`${tunnel.label} exited before providing a public URL (code ${tunnel.child.exitCode ?? 'none'}).`)
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
  }
  throw new Error(`${tunnel.label} did not provide a public URL. See qa/preview/${tunnel.logFileName}.`)
}

async function waitForDns(hostname, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs
  let lastError = 'not resolvable yet'
  while (Date.now() < deadline) {
    try {
      const addresses = await dns.lookup(hostname, { all: true })
      if (addresses.length > 0) return
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
  }
  throw new Error(`Public hostname DNS is unavailable on this computer: ${lastError}`)
}

async function verifyPublicGilarUrl(publicUrl, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  let lastError = 'not reachable yet'
  const browserHeaders = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
  }
  while (Date.now() < deadline) {
    try {
      await waitForDns(new URL(publicUrl).hostname, 4_000)
      const pageResponse = await fetch(`${publicUrl}/`, {
        redirect: 'follow',
        headers: browserHeaders,
        signal: AbortSignal.timeout(5_000),
      })
      const pageHtml = await pageResponse.text()
      if (pageResponse.status === 511 || pageHtml.includes('Tunnel website ahead') || pageHtml.includes('To continue, enter the IP shown above')) {
        throw new Error('browser tunnel warning page requires manual confirmation')
      }
      if (!pageResponse.ok || !pageHtml.includes('Gilar')) {
        lastError = `browser frontend HTTP ${pageResponse.status}`
      } else {
        const apiResponse = await fetch(`${publicUrl}/api/synthetic/overview`, {
          redirect: 'follow',
          headers: browserHeaders,
          signal: AbortSignal.timeout(5_000),
        })
        if (apiResponse.ok) {
          log(`Public Gilar URL responded with a healthy frontend and API.`)
          return
        }
        lastError = `API HTTP ${apiResponse.status}`
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000))
  }
  throw new Error(`Public Gilar URL was not reachable: ${lastError}`)
}

function writeState(active = true) {
  writeFileSync(statePath, JSON.stringify({ active, launcherPid: process.pid, childPids: children.map(({ child }) => child.pid).filter(Boolean), startedAt: new Date().toISOString() }, null, 2))
}

function killProcessTree(pid) {
  if (pid) spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
}

function stopTunnel(tunnel) {
  if (!tunnel?.child?.pid) return
  expectedStops.add(tunnel.child)
  killProcessTree(tunnel.child.pid)
}

function cleanup() {
  if (stopping) return
  stopping = true
  for (const { child, logStream } of children.slice().reverse()) {
    logStream.end()
    killProcessTree(child.pid)
  }
  writeState(false)
  rmSync(urlPath, { force: true })
  log('Stopped the Gilar API, Vite server, and active public tunnel.')
}

function openBrowser(url) {
  spawn('cmd.exe', ['/c', 'start', '', url], { cwd: projectRoot, windowsHide: true, stdio: 'ignore', detached: true }).unref()
}

async function start() {
  ensureDirectories()
  rmSync(urlPath, { force: true })
  rmSync(statePath, { force: true })

  const serverEnvironment = safeEnvironment({
    NODE_ENV: 'development',
    DEMO_MODE: 'true',
    GILAR_MODE: 'synthetic',
    PORT: String(apiPort),
    APP_ORIGIN: localWebUrl,
    SESSION_SECRET: randomBytes(32).toString('hex'),
  })
  const clientEnvironment = safeEnvironment({ NODE_ENV: 'development', VITE_GILAR_MODE: 'synthetic', VITE_GILAR_ENABLE_DATA_EXPLORER: 'false' })
  startProcess('API', 'npm.cmd', ['run', 'server'], serverEnvironment, 'api.log')
  await waitForHttp(`http://127.0.0.1:${apiPort}/health`, 'Express API')
  startProcess('Vite', 'npm.cmd', ['run', 'dev', '--', '--host', webBindHost, '--port', String(webPort)], clientEnvironment, 'vite.log')
  await waitForHttp(`${localWebUrl}/`, 'Gilar frontend')
  writePreviewUrls({ publicStatus: 'starting optional tunnel' })
  writeState()

  log('')
  log(`LOCAL GILAR: ${localWebUrl}`)
  if (lanWebUrl) log(`LAN GILAR: ${lanWebUrl}`)
  log('PUBLIC GILAR: starting optional Cloudflare Quick Tunnel...')
  log(`URL file: ${urlPath}`)
  log('Local Gilar is working. The local URL is the primary desktop testing URL.')
  openBrowser(localWebUrl)

  void (async () => {
    let publicUrl = ''
    let activeTunnel
    try {
      await downloadCloudflared()
      activeTunnel = {
        label: 'Cloudflare Quick Tunnel',
        logFileName: 'cloudflared.log',
        urlPattern: /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i,
        child: startProcess('Tunnel', cloudflaredPath, ['tunnel', '--no-autoupdate', '--url', localWebUrl], safeEnvironment({}), 'cloudflared.log', false),
      }
      writeState()
      const cloudflareUrl = await waitForTunnelUrl(activeTunnel)
      await verifyPublicGilarUrl(cloudflareUrl)
      publicUrl = cloudflareUrl
      log('Cloudflare Quick Tunnel is the active public tunnel.')
    } catch (cloudflareError) {
      if (activeTunnel) stopTunnel(activeTunnel)
      log(`Cloudflare public reachability failed; trying LocalTunnel fallback.`)
      writePreviewUrls({ publicStatus: 'starting LocalTunnel fallback' })
      try {
        activeTunnel = {
          label: 'LocalTunnel',
          logFileName: 'localtunnel.log',
          urlPattern: /https:\/\/[a-z0-9-]+\.(?:loca\.lt|localtunnel\.me)/i,
          child: startProcess('LocalTunnel', 'npx.cmd', ['--yes', 'localtunnel', '--port', String(webPort), '--local-host', '127.0.0.1', '--host', 'https://loca.lt'], safeEnvironment({}), 'localtunnel.log', false),
        }
        writeState()
        const localTunnelUrl = await waitForTunnelUrl(activeTunnel)
        await verifyPublicGilarUrl(localTunnelUrl)
        publicUrl = localTunnelUrl
        log('LocalTunnel is the active public tunnel.')
      } catch (localTunnelError) {
        if (activeTunnel) stopTunnel(activeTunnel)
        log('LocalTunnel is not browser-compatible here; trying the account-free Tunnelmole fallback.')
        writePreviewUrls({ publicStatus: 'starting Tunnelmole fallback' })
        try {
          activeTunnel = {
            label: 'Tunnelmole',
            logFileName: 'tunnelmole.log',
            urlPattern: /https:\/\/[a-z0-9-]+\.tunnelmole\.net/i,
            child: startProcess('Tunnelmole', 'npx.cmd', ['--yes', 'tunnelmole', String(webPort)], safeEnvironment({}), 'tunnelmole.log', false),
          }
          writeState()
          const tunnelmoleUrl = await waitForTunnelUrl(activeTunnel)
          await verifyPublicGilarUrl(tunnelmoleUrl)
          publicUrl = tunnelmoleUrl
          log('Tunnelmole is the active public tunnel.')
        } catch (tunnelmoleError) {
          if (activeTunnel) stopTunnel(activeTunnel)
          log('Local Gilar is working. Public/mobile tunnel is temporarily unavailable.')
          log(`Cloudflare detail: ${cloudflareError instanceof Error ? cloudflareError.message : String(cloudflareError)}`)
          log(`LocalTunnel detail: ${localTunnelError instanceof Error ? localTunnelError.message : String(localTunnelError)}`)
          log(`Tunnelmole detail: ${tunnelmoleError instanceof Error ? tunnelmoleError.message : String(tunnelmoleError)}`)
        }
      }
    }
    if (stopping) return
    writePreviewUrls({ publicUrl, publicStatus: publicUrl ? 'ready' : 'unavailable' })
    log(`PUBLIC GILAR: ${publicUrl || 'Unavailable'}`)
    if (publicUrl) log('The public URL is optional; keep this window open while using it from a phone or tablet.')
  })()

  await new Promise(() => {})
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.once(signal, () => { cleanup(); process.exit(0) })
process.once('exit', cleanup)
process.once('uncaughtException', (error) => { console.error(error); cleanup(); process.exitCode = 1 })

start().catch((error) => { console.error(`[Gilar Preview] ${error instanceof Error ? error.message : String(error)}`); cleanup(); process.exitCode = 1 })
