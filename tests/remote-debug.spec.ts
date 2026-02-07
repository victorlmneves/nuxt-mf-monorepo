import { test } from '@playwright/test'
import fs from 'fs'

test('remote debug capture', async ({ page }) => {
  const logs: any = { console: [], requests: [], responses: [], failures: [] }

  page.on('console', (msg) => {
    logs.console.push({ type: msg.type(), text: msg.text() })
  })

  page.on('request', (req) => {
    logs.requests.push({ url: req.url(), method: req.method() })
  })

  page.on('response', async (res) => {
    logs.responses.push({ url: res.url(), status: res.status(), statusText: res.statusText() })
  })

  page.on('requestfailed', (req) => {
    logs.failures.push({ url: req.url(), method: req.method(), failure: req.failure() })
  })

  const url = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000/remote-example?scope=checkout'
  await page.goto(url, { waitUntil: 'networkidle' })
  // give client a moment to load remote and log
  await page.waitForTimeout(2000)

  // take screenshot and save
  await page.screenshot({ path: 'remote-debug.png', fullPage: true })
  fs.writeFileSync('remote-debug.json', JSON.stringify(logs, null, 2))
})
