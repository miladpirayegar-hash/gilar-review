import { test, expect } from '@playwright/test'

const reviewBasePath = process.env.REVIEW_BASE_PATH ?? '/'
const reviewPath = (path: string) => `${reviewBasePath}#${path}`

test.beforeEach(async ({ page }) => {
  await page.goto(reviewBasePath)
  await page.evaluate(() => {
    window.localStorage.removeItem('gilar-review-state-v1')
    window.localStorage.removeItem('gilar-review-state-v2')
  })
})

test('static review build completes the Northstar synthetic journey', async ({ page }) => {
  await page.goto(reviewPath('/app/home'))
  await expect(page.getByRole('heading', { name: 'Here’s what needs your attention.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What needs your attention', exact: true })).toBeVisible()

  await page.goto(reviewPath('/app/opportunities'))
  await expect(page.getByRole('heading', { name: 'What I would fix first.' })).toBeVisible()
  await page.getByRole('button', { name: 'Investigate' }).first().click()
  await expect(page.getByRole('heading', { name: 'Why this is happening' })).toBeVisible()
  await page.getByRole('button', { name: 'See the fix' }).click()

  await expect(page.getByRole('heading', { name: 'The fix' })).toBeVisible()
  await page.getByRole('button', { name: /Review & start/i }).click()
  await page.getByRole('button', { name: 'Propose deployment' }).click()
  await page.getByRole('button', { name: 'Approve action' }).click()
  await page.getByRole('button', { name: 'Deploy solution' }).click()
  const advance = page.getByRole('button', { name: 'Advance 30 days' })
  await expect(advance).toBeEnabled()
  await advance.click({ noWaitAfter: true })
  await expect(page.getByText(/Simulation: completed/)).toBeVisible()

  await page.goto(reviewPath('/app/insights'))
  await expect(page.getByRole('heading', { name: 'Proposal preparation got faster.' })).toBeVisible()
  await expect(page.getByText('58m', { exact: true }).first()).toBeVisible()
})

test('static review build serves deep links and remains usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(reviewPath('/app/brief'))
  await expect(page.getByRole('heading', { name: 'Your daily brief' })).toBeVisible()
  await page.goto(reviewPath('/app/agents'))
  await expect(page.getByRole('heading', { name: 'Automations' })).toBeVisible()
  await expect(page.locator('body')).toBeVisible()
})

test('static review MRI completion opens Today instead of a blank route', async ({ page }) => {
  await page.goto(reviewPath('/onboarding/mri'))
  await page.getByRole('button', { name: 'See what needs attention' }).click()
  await expect(page).toHaveURL(/#\/app\/home$/)
  await expect(page.getByRole('heading', { name: 'Here’s what needs your attention.' })).toBeVisible()
})
