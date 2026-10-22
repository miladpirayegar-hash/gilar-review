import { test, expect, type APIRequestContext } from '@playwright/test'

const apiBase = 'http://127.0.0.1:8787'

async function reset(request: APIRequestContext) {
  const response = await request.post(`${apiBase}/api/synthetic/reset`)
  expect(response.ok()).toBeTruthy()
}

async function setScenario(request: APIRequestContext, scenario: string) {
  const response = await request.post(`${apiBase}/api/synthetic/scenario`, { data: { scenario } })
  expect(response.ok()).toBeTruthy()
}

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => reset(request))

test('Northstar synthetic diagnosis to measured ROI', async ({ page }) => {
  await page.goto('/app/executive')
  await expect(page.getByRole('heading', { name: 'Business health overview' })).toBeVisible()
  await expect(page.getByText('How Business Health is calculated')).toBeVisible()
  await expect(page.getByText('84%', { exact: true })).toBeVisible()

  await page.goto('/app/home')
  await expect(page.getByRole('heading', { name: 'Here’s what needs your attention.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What needs your attention', exact: true })).toBeVisible()
  await page.goto('/app/opportunities')
  await expect(page.getByRole('heading', { name: 'What I would fix first.' })).toBeVisible()
  await expect(page.getByText('A practical starting point')).toBeVisible()
  await page.getByRole('button', { name: 'Investigate' }).first().click()

  await expect(page.getByRole('heading', { name: 'Why this is happening' })).toBeVisible()
  await expect(page.getByText('How the signal connects')).toBeVisible()
  await expect(page.getByText(/HubSpot/).first()).toBeVisible()
  await page.getByRole('button', { name: 'See the fix' }).click()

  await expect(page.getByRole('heading', { name: 'The fix' })).toBeVisible()
  await expect(page.getByText('Approval required before deployment')).toBeVisible()
  await page.getByRole('button', { name: /Review & start/i }).click()

  await expect(page.getByRole('button', { name: 'Propose deployment' })).toBeVisible()
  await page.getByRole('button', { name: 'Propose deployment' }).click()
  await expect(page.getByRole('button', { name: 'Approve action' })).toBeVisible()
  await page.getByRole('button', { name: 'Approve action' }).click()
  await expect(page.getByRole('button', { name: 'Deploy solution' })).toBeVisible()
  await page.getByRole('button', { name: 'Deploy solution' }).click()

  const advance = page.getByRole('button', { name: 'Advance 30 days' })
  await expect(advance).toBeEnabled()
  await advance.click({ noWaitAfter: true })
  await expect(page.getByText(/Simulation: completed/)).toBeVisible()

  await page.goto('/app/insights')
  await expect(page.getByRole('heading', { name: 'Proposal preparation got faster.' })).toBeVisible()
  await expect(page.getByText('58m', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('5.2x', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Measured/).first()).toBeVisible()
  await expect(page.getByText(/Estimated/).first()).toBeVisible()
})

test('low-confidence diagnosis is explicit about insufficient data', async ({ page, request }) => {
  await setScenario(request, 'low_confidence')
  await page.goto('/app/opportunities/root-cause')

  await expect(page.getByText('Low-confidence diagnosis')).toBeVisible()
  await expect(page.getByText(/current data is insufficient to establish the root cause/i).first()).toBeVisible()
  await expect(page.getByText('low confidence', { exact: true }).first()).toBeVisible()
})

test('partial coverage is visible before a user acts', async ({ page, request }) => {
  await setScenario(request, 'partial_coverage')
  await page.goto('/app/brief')

  await expect(page.getByText('Partial coverage')).toBeVisible()
  await expect(page.getByText(/source systems are unavailable/i)).toBeVisible()
  await expect(page.getByText(/directional/i).first()).toBeVisible()
})

test('failed action is shown as safely rejected', async ({ page, request }) => {
  await setScenario(request, 'failed_action')
  await page.goto('/app/agents')

  await expect(page.getByText('Action failed safely')).toBeVisible()
  await expect(page.getByText(/No records were changed/i)).toBeVisible()
  await expect(page.getByText('paused', { exact: true }).first()).toBeVisible()
})

test('no-ROI outcome explains why attribution is unavailable', async ({ page, request }) => {
  await setScenario(request, 'no_roi')
  await page.goto('/app/insights')

  await expect(page.getByText('No measurable ROI is available')).toBeVisible()
  await expect(page.getByText(/could not attribute a reliable business result/i)).toBeVisible()
  await expect(page.getByText('ROI methodology will appear once a measurable outcome exists.')).toBeVisible()
})

test('conflicting evidence lowers confidence instead of forcing a conclusion', async ({ page, request }) => {
  await setScenario(request, 'conflicting_evidence')
  await page.goto('/app/opportunities/root-cause')

  await expect(page.getByText('Evidence is mixed').first()).toBeVisible()
  await expect(page.getByText(/CRM activity increased while revenue declined/i).first()).toBeVisible()
  await expect(page.getByText('58% confidence')).toBeVisible()
})
