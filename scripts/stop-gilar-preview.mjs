import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const statePath = join(projectRoot, '.gilar-preview-state.json')
const urlPath = join(projectRoot, 'CURRENT_PREVIEW_URL.txt')

if (existsSync(statePath)) {
  try {
    const state = JSON.parse(readFileSync(statePath, 'utf8'))
    if (state.active !== false) {
      for (const pid of state.childPids ?? []) {
        if (Number.isInteger(pid) && pid > 0) {
          spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
            windowsHide: true,
            stdio: 'ignore',
          })
        }
      }
      if (Number.isInteger(state.launcherPid) && state.launcherPid > 0 && state.launcherPid !== process.pid) {
        spawnSync('taskkill.exe', ['/PID', String(state.launcherPid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        })
      }
    }
  } catch {
    // The launcher may already have removed or partially written its state.
  }
}

rmSync(statePath, { force: true })
writeFileSync(urlPath, 'LOCAL: http://127.0.0.1:5175\nPUBLIC: UNAVAILABLE\nPUBLIC STATUS: stopped\n')
console.log('[Gilar Preview] Cleanup requested. Local services and tunnel processes have been stopped.')
