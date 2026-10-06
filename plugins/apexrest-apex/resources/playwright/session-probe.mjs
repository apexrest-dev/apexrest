// Read-only check of saved browser state before E2E. It opens the base URL only:
// no input, clicks, screenshots, traces or cookie output. Prints one classification.
import { chromium } from '@playwright/test';
const [statePath, baseURL, encodedOrigins, marker] = process.argv.slice(2);
const origins = JSON.parse(encodedOrigins);
let session = 'unknown';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ storageState: statePath, serviceWorkers: 'block' });
  await context.route('**/*', route => origins.includes(new URL(route.request().url()).origin) ? route.continue() : route.abort('blockedbyclient'));
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: 'load', timeout: 30000 });
  if (marker && await page.getByTestId(marker).first().isVisible()) session = 'authenticated';
  // An APEX login page shows a password field where the authenticated marker should be.
  else if (await page.locator('input[type="password"]').first().isVisible()) session = 'login';
} finally { await browser.close(); }
process.stdout.write(JSON.stringify({ session }) + '\n');
