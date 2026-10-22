import { cp, mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? process.env.GILAR_REVIEW_REPO ?? 'gilar-review'
const basePath = process.env.VITE_BASE_PATH ?? `/${repoName}/`
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

await new Promise((resolve, reject) => {
  const child = spawn(npmCommand, ['run', 'build'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, VITE_GILAR_MODE: 'review', VITE_BASE_PATH: basePath },
  })
  child.once('error', reject)
  child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Review build exited with code ${code}.`)))
})

await mkdir('dist', { recursive: true })
await cp(join('dist', 'index.html'), join('dist', '404.html'))
console.log(`Prepared GitHub Pages review build with base path ${basePath}`)
