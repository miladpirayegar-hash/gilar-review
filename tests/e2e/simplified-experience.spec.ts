import { test, expect } from '@playwright/test'

test('customer path stays focused on Today, Fixes, and Results', async ({ page }) => {
  await page.goto('/app/home')
  await expect(page.getByRole('heading', { name: 'Here’s what needs your attention.' })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Today' })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', { name: /Fixes/ })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Results' })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Agents' })).toHaveCount(0)
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Documents' })).toHaveCount(0)
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Team' })).toHaveCount(0)

  await page.goto('/app/opportunities')
  await expect(page.getByRole('heading', { name: 'What I would fix first.' })).toBeVisible()
  await page.goto('/app/insights')
  await expect(page.getByRole('heading', { name: 'What changed.' })).toBeVisible()
})

test('Today remains usable on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/home')
  await expect(page.getByRole('heading', { name: 'Here’s what needs your attention.' })).toBeVisible()
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Today' })).toBeVisible()
  const width = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }))
  expect(width.document).toBeLessThanOrEqual(width.viewport + 1)
})
