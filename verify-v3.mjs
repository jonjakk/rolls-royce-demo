import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const BASE = 'http://localhost:3000';
const DIR = join(import.meta.dirname, 'verify-screenshots');

(async () => {
  await mkdir(DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

  const page = await context.newPage();

  // Collect console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text().slice(0, 200));
  });
  page.on('pageerror', err => errors.push(err.message.slice(0, 200)));

  // Track failed requests
  const failedRequests = [];
  page.on('requestfailed', req => {
    failedRequests.push({ url: req.url().slice(0, 150), error: req.failure()?.errorText });
  });

  console.log('Loading configurator...');
  await page.goto(`${BASE}/en_GB/bespoke/configure-your-rolls-royce.html`, {
    waitUntil: 'domcontentloaded', timeout: 30000
  });

  // Accept cookies
  try {
    const btn = page.locator('button:has-text("ACCEPT ALL"), [data-testid="uc-accept-all-button"]');
    if (await btn.first().isVisible({ timeout: 5000 })) {
      await btn.first().click();
      console.log('Accepted cookies');
    }
  } catch {}

  console.log('Waiting 15s for Angular to load...');
  await page.waitForTimeout(15000);

  // Screenshot top
  await page.screenshot({ path: join(DIR, 'v3-top.png') });

  // Scroll to model section
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(DIR, 'v3-models.png') });

  // Full scroll
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 400) {
    await page.evaluate(sy => window.scrollTo(0, sy), y);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(3000);

  // Full page screenshot
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(DIR, 'v3-full.png'), fullPage: true });

  // Check page height
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  console.log(`\nPage height: ${pageHeight}px`);

  // Check rr-model-selection
  const modelInfo = await page.evaluate(() => {
    const el = document.querySelector('rr-model-selection');
    if (!el) return { exists: false };

    const shadow = el.shadowRoot;
    if (!shadow) return { exists: true, hasShadow: false };

    const tabs = shadow.querySelectorAll('[role="tab"], .tab, button');
    const tabTexts = [...tabs].map(t => t.textContent?.trim()).filter(t => t && t.length < 30);

    const imgs = shadow.querySelectorAll('img');
    const visibleImgs = [...imgs].filter(i => i.naturalWidth > 0 && i.offsetWidth > 0);

    const configBtn = shadow.querySelector('a[href*="configure"]') || [...shadow.querySelectorAll('button, a')].find(b => b.textContent?.includes('CONFIGURE'));
    const spinner = shadow.querySelector('.spinner') || shadow.querySelector('[class*="spinner"]') || shadow.querySelector('[class*="loading"]');

    const content = shadow.querySelector('app-model-selection-content, [class*="content"]');
    const isHidden = content?.classList?.contains('hidden');

    return {
      exists: true,
      hasShadow: true,
      shadowChildCount: shadow.childElementCount,
      tabs: tabTexts,
      totalImages: imgs.length,
      visibleImages: visibleImgs.length,
      hasConfigureButton: !!configBtn,
      hasSpinner: !!spinner,
      spinnerVisible: spinner ? (spinner.offsetWidth > 0) : false,
      contentHidden: isHidden,
      innerText: shadow.textContent?.slice(0, 300),
    };
  });

  console.log('\n=== Model Selection Component ===');
  console.log(`  Exists: ${modelInfo.exists}`);
  if (modelInfo.exists) {
    console.log(`  Shadow DOM: ${modelInfo.hasShadow}`);
    console.log(`  Shadow children: ${modelInfo.shadowChildCount}`);
    console.log(`  Tabs: ${modelInfo.tabs?.join(', ') || 'NONE'}`);
    console.log(`  Images: ${modelInfo.totalImages} total, ${modelInfo.visibleImages} visible`);
    console.log(`  Configure button: ${modelInfo.hasConfigureButton}`);
    console.log(`  Spinner: ${modelInfo.hasSpinner} (visible: ${modelInfo.spinnerVisible})`);
    console.log(`  Content hidden: ${modelInfo.contentHidden}`);
    console.log(`  Inner text preview: ${modelInfo.innerText?.slice(0, 200)}`);
  }

  console.log(`\n=== Failed Requests (${failedRequests.length}) ===`);
  failedRequests.forEach(r => console.log(`  ${r.error}: ${r.url}`));

  console.log(`\n=== Console Errors (${errors.length}) ===`);
  errors.slice(0, 15).forEach(e => console.log(`  ${e}`));

  // If model tabs exist, try clicking Phantom
  if (modelInfo.tabs?.length > 0) {
    console.log('\nClicking Phantom tab...');
    try {
      const phantomTab = page.locator('rr-model-selection').locator('text=PHANTOM').first();
      await phantomTab.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: join(DIR, 'v3-phantom.png') });
      console.log('Phantom tab clicked and screenshot taken');
    } catch (e) {
      console.log(`Could not click tab: ${e.message.split('\n')[0]}`);
    }
  }

  await browser.close();
  console.log('\nDone. Screenshots in', DIR);
})();
