import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SyntheticDemoService } from '../server/synthetic/service'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = join(projectRoot, 'src', 'data', 'reviewFixture.json')
const scope = { organizationId: 'org_northstar_review', workspaceId: 'ws_northstar_review' }
const service = new SyntheticDemoService()
const overview = service.overview(scope)

writeFileSync(outputPath, `${JSON.stringify(overview, null, 2)}\n`)
console.log(`Generated ${outputPath}`)
