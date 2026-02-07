const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
    const logs = { console: [], requests: [], responses: [], failures: [] };
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', (msg) => {
        logs.console.push({ type: msg.type(), text: msg.text() });
    });

    page.on('request', (req) => {
        logs.requests.push({ url: req.url(), method: req.method() });
    });

    page.on('response', (res) => {
        logs.responses.push({ url: res.url(), status: res.status(), statusText: res.statusText() });
    });

    page.on('requestfailed', (req) => {
        logs.failures.push({ url: req.url(), method: req.method(), failure: req.failure() });
    });

    const url = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000/remote-example?scope=checkout';
    console.log('navigating to', url);

    // HMR/websocket can keep connections open and prevent "networkidle" from resolving.
    // Use DOMContentLoaded then wait for remote content or short timeout.
    page.setDefaultNavigationTimeout(60000);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // wait for the remote-example container to be present
    try {
        await page.waitForSelector('.remote-example', { timeout: 20000 });
    } catch (e) {
        console.warn('remote-example selector not found within timeout');
    }

    // wait for either remote content or a small delay to allow client loader
    await page.waitForTimeout(2500);

    const screenshotPath = 'remote-debug-node.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });

    fs.writeFileSync('remote-debug-node.json', JSON.stringify(logs, null, 2));
    console.log('wrote', screenshotPath, 'and remote-debug-node.json');

    await browser.close();
})().catch((err) => {
    console.error(err);

    process.exit(1);
});
