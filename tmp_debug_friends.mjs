import { chromium } from 'playwright';

const errors = [];
const logs = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

page.on('pageerror', (error) => {
  errors.push({
    message: error?.message || String(error),
    stack: error?.stack || null,
    name: error?.name || null,
  });
});

page.on('console', (msg) => {
  logs.push({ type: msg.type(), text: msg.text() });
});

await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const friendsTab = page.getByRole('button', { name: /^(Друзья|Friends)$/i });
if (!(await friendsTab.isVisible().catch(() => false))) {
  const switchToRegister = page.getByRole('button', { name: /(Нет аккаунта\? Создать|No account\? Create one)/i });
  if (await switchToRegister.isVisible().catch(() => false)) {
    await switchToRegister.click();
    await page.waitForTimeout(250);
  }
  const suffix = Date.now().toString().slice(-6);
  await page.locator('input[type="email"]').fill(`qa${suffix}@example.com`);
  await page.locator('input[type="text"]').fill(`qa_${suffix}`);
  await page.locator('input[type="password"]').fill('password123');
  await page.getByRole('button', { name: /(Создать аккаунт|Create account)/i }).click();
  await page.waitForTimeout(2200);
}

await page.getByRole('button', { name: /^(Друзья|Friends)$/i }).click();
await page.waitForTimeout(1500);

await page.screenshot({ path: '/tmp/brgram_debug_after_friends_click.png', fullPage: true });

const bodyHtmlLen = await page.evaluate(() => document.body.innerHTML.length);
const rootHtmlLen = await page.evaluate(() => document.getElementById('root')?.innerHTML.length ?? 0);

console.log(JSON.stringify({
  bodyHtmlLen,
  rootHtmlLen,
  errors,
  logs: logs.slice(-60),
}, null, 2));

await browser.close();
