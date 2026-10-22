import { test, expect } from '@playwright/test'

const reviewPath = (path: string) => `/#${path}`

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.removeItem('gilar-review-state-v1'))
})

test('static review build completes the Northstar synthetic journey', async ({ page }) => {
  await page.goto(reviewPath('/app/executive'))
  await expect(page.getByRole('heading', { name: 'Business health overview' })).toBeVisible()
  await expect(page.getByText('How Business Health is calculated')).toBeVisible()

  await page.goto(reviewPath('/app/opportunities'))
  await expect(page.getByRole('heading', { name: 'Your opportunity map' })).toBeVisible()
  await page.getByRole('button', { name: 'Explore top opportunity' }).click()
  await expect(page.getByRole('heading', { name: 'Sales conversion decline' })).toBeVisible()
  await page.getByRole('button', { name: 'Review recommendation' }).click()

  await expect(page.getByRole('heading', { name: 'Proposal Intelligence workflow' })).toBeVisible()
  await page.getByRole('button', { name: /start approval/i }).click()
  await page.getByRole('button', { name: 'Propose deployment' }).click()
  await page.getByRole('button', { name: 'Approve action' }).click()
  await page.getByRole('button', { name: 'Deploy solution' }).click()
  const advance = page.getByRole('button', { name: 'Advance 30 days' })
  await expect(advance).toBeEnabled()
  await advance.click({ noWaitAfter: true })
  await page.waitForLoadState('load')

  await page.goto(reviewPath('/app/insights'))
  await expect(page.getByText('Proposal Intelligence measured an improvement')).toBeVisible()
  await expect(page.getByText('58m / proposal')).toBeVisible()
})

test('static review build serves deep links and remains usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(reviewPath('/app/brief'))
  await expect(page.getByRole('heading', { name: 'Your Daily Brief' })).toBeVisible()
  await page.goto(reviewPath('/app/agents'))
  await expect(page.getByRole('heading', { name: 'AI Agents' })).toBeVisible()
  await expect(page.locator('body')).toBeVisible()
})
