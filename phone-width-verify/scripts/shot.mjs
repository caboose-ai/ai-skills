// Phone-width screenshots of a web app, light and dark, with an overflow check.
// Usage: node shot.mjs <base-url> [path...]
// Env: OUT_DIR (default ./shots), APP_PASSWORD (default "dev"; empty skips
// login), LOGIN_PATH (/login), PASSWORD_SELECTOR (#password),
// SUBMIT_SELECTOR (button[type=submit]).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Resolve Playwright from the project first, then from the global install.
// ESM imports ignore NODE_PATH, so use require with an explicit fallback.
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return require(join(globalRoot, 'playwright'));
})();

const [base = 'http://localhost:8099', ...paths] = process.argv.slice(2);
const outDir = process.env.OUT_DIR || './shots';
const password = process.env.APP_PASSWORD ?? 'dev';
const loginPath = process.env.LOGIN_PATH || '/login';
const passwordSel = process.env.PASSWORD_SELECTOR || '#password';
const submitSel = process.env.SUBMIT_SELECTOR || 'button[type=submit]';
mkdirSync(outDir, { recursive: true });

async function login(page) {
  await page.goto(base + loginPath);
  await page.fill(passwordSel, password);
  await Promise.all([page.waitForNavigation(), page.click(submitSel)]);
}

const browser = await chromium.launch();
try {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true, colorScheme: scheme,
    });
    const page = await ctx.newPage();
    if (password) await login(page);
    for (const p of paths.length ? paths : ['/']) {
      await page.goto(base + p);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const file = join(outDir, `${p.replace(/[^a-z0-9]+/gi, '_') || 'root'}-${scheme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`${file}${overflow ? '  WARNING: horizontal overflow' : ''}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
