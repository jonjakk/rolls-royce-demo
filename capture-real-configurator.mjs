import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join, extname } from 'path';
import { createHash } from 'crypto';
import { URL } from 'url';

const CONFIGURATOR_URL = 'https://www.rolls-roycemotorcars.com/en_GB/bespoke/configure-your-rolls-royce.html';
const OUTPUT_DIR = join(import.meta.dirname, 'site');
const API_DIR = join(OUTPUT_DIR, '_configurator-api');
const SCREENSHOTS_DIR = join(OUTPUT_DIR, '_configurator-screenshots');

const savedResources = new Map();
const apiResponses = [];
let resourceCount = 0;

function urlToLocalPath(urlStr) {
  try {
    const url = new URL(urlStr);
    let pathname = url.pathname;
    if (pathname.endsWith('/')) pathname += 'index.html';
    const host = url.hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
    let localPath = join(OUTPUT_DIR, host, pathname);
    if (url.search) {
      const hash = createHash('md5').update(url.search).digest('hex').slice(0, 8);
      const ext = extname(localPath);
      localPath = ext ? localPath.replace(ext, `_${hash}${ext}`) : localPath + `_${hash}`;
    }
    return localPath;
  } catch { return null; }
}

function shouldCapture(urlStr) {
  try {
    const url = new URL(urlStr);
    if (url.protocol === 'data:' || url.protocol === 'blob:') return false;
    const skip = ['google-analytics.com', 'doubleclick.net', 'facebook.net'];
    if (skip.some(d => url.hostname.includes(d))) return false;
    return true;
  } catch { return false; }
}

async function saveResource(url, body) {
  const localPath = urlToLocalPath(url);
  if (!localPath || savedResources.has(url)) return;
  savedResources.set(url, localPath);
  try {
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, body);
    resourceCount++;
    if (resourceCount % 50 === 0) console.log(`    [resources] ${resourceCount} saved`);
  } catch {}
}

async function saveApiResponse(url, body, contentType, method, status) {
  const hash = createHash('md5').update(method + url).digest('hex').slice(0, 12);
  const ext = contentType?.includes('json') ? '.json' : contentType?.includes('xml') ? '.xml' : '.bin';
  const filename = `${hash}${ext}`;
  const filePath = join(API_DIR, filename);
  try {
    await mkdir(API_DIR, { recursive: true });
    await writeFile(filePath, body);
    apiResponses.push({ url, method, contentType, status, file: filename, size: body.length });
  } catch {}
}

function setupResponseCapture(page) {
  page.on('response', async (response) => {
    const url = response.url();
    const request = response.request();
    const contentType = response.headers()['content-type'] || '';
    if (!shouldCapture(url)) return;
    try {
      const body = await response.body();
      await saveResource(url, body);
      const resType = request.resourceType();
      if (resType === 'xhr' || resType === 'fetch' || contentType.includes('json') ||
          url.includes('/api/') || url.includes('/rest/') || url.includes('.json') ||
          url.includes('configurator') || url.includes('config') || url.includes('model')) {
        await saveApiResponse(url, body, contentType, request.method(), response.status());
      }
    } catch {}
  });
}

(async () => {
  console.log('=== Real Configurator Capture ===\n');
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  await mkdir(API_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-GB',
  });

  // Phase 1: Load the configure page
  console.log('Phase 1: Loading configure-your-rolls-royce page...');
  const page = await context.newPage();
  setupResponseCapture(page);

  try {
    await page.goto(CONFIGURATOR_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
  } catch (e) {
    console.log(`  Load note: ${e.message.split('\n')[0]}`);
  }

  // Accept cookies
  try {
    const cookieBtn = page.locator('[data-testid="uc-accept-all-button"], .cmm-cookie-banner__btn--accept, #onetrust-accept-btn-handler, button:has-text("ACCEPT ALL")');
    if (await cookieBtn.first().isVisible({ timeout: 3000 })) {
      await cookieBtn.first().click();
      console.log('  Accepted cookies');
      await page.waitForTimeout(1000);
    }
  } catch {}

  await page.screenshot({ path: join(SCREENSHOTS_DIR, '10-configurator-real-landing.png'), fullPage: false });
  console.log('  Screenshot: configurator landing');

  // Analyze the page
  const pageInfo = await page.evaluate(() => {
    return {
      title: document.title,
      hasIframe: !!document.querySelector('iframe'),
      iframeSrc: document.querySelector('iframe')?.src || null,
      hasCanvas: !!document.querySelector('canvas'),
      h1: document.querySelector('h1')?.textContent?.trim() || '',
      h2s: [...document.querySelectorAll('h2')].map(h => h.textContent.trim()).slice(0, 10),
      allLinks: [...document.querySelectorAll('a[href]')].map(a => ({
        href: a.href, text: a.textContent?.trim().slice(0, 60)
      })).filter(l => l.text.length > 0).slice(0, 30),
      buttons: [...document.querySelectorAll('button, [role="button"], .cta, [class*="cta"]')]
        .map(b => ({ text: b.textContent?.trim().slice(0, 60), classes: b.className?.slice(0, 80) }))
        .filter(b => b.text.length > 0 && b.text.length < 60)
        .slice(0, 20),
      imgs: document.querySelectorAll('img').length,
      videos: document.querySelectorAll('video').length,
    };
  });

  console.log(`\n  Page title: ${pageInfo.title}`);
  console.log(`  H1: ${pageInfo.h1}`);
  console.log(`  H2s: ${pageInfo.h2s.join(' | ')}`);
  console.log(`  Has iframe: ${pageInfo.hasIframe}${pageInfo.iframeSrc ? ' → ' + pageInfo.iframeSrc.slice(0, 100) : ''}`);
  console.log(`  Has canvas: ${pageInfo.hasCanvas}`);
  console.log(`  Images: ${pageInfo.imgs}, Videos: ${pageInfo.videos}`);
  console.log(`\n  Links (${pageInfo.allLinks.length}):`);
  pageInfo.allLinks.filter(l => l.href.includes('configur') || l.href.includes('model') || l.href.includes('showroom')).forEach(l => {
    console.log(`    → "${l.text}" → ${l.href}`);
  });
  console.log(`\n  Buttons (${pageInfo.buttons.length}):`);
  pageInfo.buttons.slice(0, 10).forEach(b => {
    console.log(`    → "${b.text}" [${b.classes}]`);
  });

  // Scroll the entire page
  console.log('\n  Scrolling page...');
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < scrollHeight; y += 540) {
    await page.evaluate((sy) => window.scrollTo(0, sy), y);
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2000);

  await page.screenshot({ path: join(SCREENSHOTS_DIR, '11-configurator-real-full.png'), fullPage: true });
  console.log('  Screenshot: full page');

  // Phase 2: If there's an iframe (configurator tool), capture it
  if (pageInfo.hasIframe && pageInfo.iframeSrc) {
    console.log(`\nPhase 2: Capturing configurator iframe: ${pageInfo.iframeSrc}`);
    const iframePage = await context.newPage();
    setupResponseCapture(iframePage);

    try {
      await iframePage.goto(pageInfo.iframeSrc, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await iframePage.waitForTimeout(8000);
      await iframePage.screenshot({ path: join(SCREENSHOTS_DIR, '12-configurator-iframe.png'), fullPage: false });
      console.log('  Screenshot: iframe content');

      // Analyze iframe content
      const iframeInfo = await iframePage.evaluate(() => ({
        title: document.title,
        hasCanvas: !!document.querySelector('canvas'),
        buttons: [...document.querySelectorAll('button, [role="button"]')]
          .map(b => b.textContent?.trim().slice(0, 60))
          .filter(t => t.length > 0 && t.length < 60)
          .slice(0, 20),
        scripts: [...document.querySelectorAll('script[src]')].map(s => s.src).slice(0, 10),
      }));
      console.log(`  Iframe title: ${iframeInfo.title}`);
      console.log(`  Iframe has canvas: ${iframeInfo.hasCanvas}`);
      console.log(`  Iframe buttons: ${iframeInfo.buttons.join(', ')}`);

      // Scroll iframe
      const iframeHeight = await iframePage.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y < iframeHeight; y += 540) {
        await iframePage.evaluate((sy) => window.scrollTo(0, sy), y);
        await iframePage.waitForTimeout(300);
      }
      await iframePage.waitForTimeout(3000);
      await iframePage.screenshot({ path: join(SCREENSHOTS_DIR, '13-configurator-iframe-scrolled.png'), fullPage: true });

      // Get the fully rendered HTML
      const iframeHtml = await iframePage.content();
      const iframeUrl = new URL(pageInfo.iframeSrc);
      const iframeHtmlPath = join(OUTPUT_DIR, iframeUrl.hostname.replace(/[^a-zA-Z0-9.-]/g, '_'), iframeUrl.pathname || 'index.html');
      await mkdir(dirname(iframeHtmlPath), { recursive: true });
      await writeFile(iframeHtmlPath, iframeHtml, 'utf-8');
      console.log(`  Saved iframe HTML to ${iframeHtmlPath}`);

    } catch (e) {
      console.log(`  Iframe error: ${e.message.split('\n')[0]}`);
    }
    await iframePage.close();
  }

  // Phase 3: Try to interact with the configurator — find car model cards/links
  console.log('\nPhase 3: Interacting with configurator...');

  // Look for car model selection elements
  const modelSelectors = [
    '.model-card', '[data-model]', '[class*="model"]', '[class*="vehicle"]',
    '.card', '[class*="card"]', 'article', '.tile',
    'a[href*="phantom"]', 'a[href*="ghost"]', 'a[href*="spectre"]', 'a[href*="cullinan"]',
    'a[href*="commission"]', 'a[href*="configure"]',
  ];

  for (const selector of modelSelectors) {
    const count = await page.locator(selector).count();
    if (count > 0) {
      console.log(`  Found ${count} elements for: ${selector}`);
      // Try clicking the first one
      try {
        const firstEl = page.locator(selector).first();
        const text = await firstEl.textContent();
        const href = await firstEl.getAttribute('href');
        console.log(`    First: "${text?.trim().slice(0, 60)}" href=${href || 'none'}`);

        if (href && !href.startsWith('#')) {
          const fullUrl = href.startsWith('http') ? href : `https://www.rolls-roycemotorcars.com${href}`;
          console.log(`    Navigating to: ${fullUrl}`);

          const modelPage = await context.newPage();
          setupResponseCapture(modelPage);
          try {
            await modelPage.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await modelPage.waitForTimeout(5000);

            // Accept cookies on model page
            try {
              const btn = modelPage.locator('[data-testid="uc-accept-all-button"], .cmm-cookie-banner__btn--accept');
              if (await btn.first().isVisible({ timeout: 1500 })) {
                await btn.first().click();
                await modelPage.waitForTimeout(500);
              }
            } catch {}

            const modelTitle = await modelPage.title();
            console.log(`    Model page title: ${modelTitle}`);
            await modelPage.screenshot({ path: join(SCREENSHOTS_DIR, `14-model-${selector.replace(/[^a-z]/g, '')}.png`), fullPage: false });

            // Check for 3D configurator elements
            const modelInfo = await modelPage.evaluate(() => ({
              hasCanvas: !!document.querySelector('canvas'),
              hasWebGL: !!document.querySelector('canvas[data-engine]'),
              hasIframe: !!document.querySelector('iframe'),
              iframeSrc: document.querySelector('iframe')?.src || null,
              hasThreeJS: typeof window.THREE !== 'undefined',
              configElements: document.querySelectorAll('[class*="config"], [class*="customiz"], [class*="option"], [class*="color"], [class*="selector"]').length,
            }));
            console.log(`    Canvas: ${modelInfo.hasCanvas}, WebGL: ${modelInfo.hasWebGL}, 3D lib: ${modelInfo.hasThreeJS}`);
            console.log(`    Config UI elements: ${modelInfo.configElements}`);
            if (modelInfo.hasIframe) console.log(`    Iframe: ${modelInfo.iframeSrc}`);

            // If there's a configurator iframe, capture it
            if (modelInfo.hasIframe && modelInfo.iframeSrc) {
              console.log(`    Capturing configurator iframe: ${modelInfo.iframeSrc}`);
              const cfgPage = await context.newPage();
              setupResponseCapture(cfgPage);
              try {
                await cfgPage.goto(modelInfo.iframeSrc, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await cfgPage.waitForTimeout(10000);
                await cfgPage.screenshot({ path: join(SCREENSHOTS_DIR, '15-3d-configurator.png'), fullPage: false });
                console.log('    Screenshot: 3D configurator');

                // Get the HTML
                const cfgHtml = await cfgPage.content();
                const cfgUrl = new URL(modelInfo.iframeSrc);
                const cfgPath = join(OUTPUT_DIR, cfgUrl.hostname.replace(/[^a-zA-Z0-9.-]/g, '_'), cfgUrl.pathname || 'index.html');
                await mkdir(dirname(cfgPath), { recursive: true });
                await writeFile(cfgPath, cfgHtml, 'utf-8');
              } catch (e) {
                console.log(`    Configurator iframe error: ${e.message.split('\n')[0]}`);
              }
              await cfgPage.close();
            }

            // Scroll the model page to capture all lazy content
            const mh = await modelPage.evaluate(() => document.body.scrollHeight);
            for (let y = 0; y < mh; y += 540) {
              await modelPage.evaluate((sy) => window.scrollTo(0, sy), y);
              await modelPage.waitForTimeout(400);
            }
            await modelPage.waitForTimeout(2000);

            // Save model page HTML
            const modelHtml = await modelPage.content();
            const modelUrlObj = new URL(fullUrl);
            const modelHtmlPath = join(OUTPUT_DIR, 'www.rolls-roycemotorcars.com', modelUrlObj.pathname);
            await mkdir(dirname(modelHtmlPath), { recursive: true });
            await writeFile(modelHtmlPath, modelHtml, 'utf-8');

          } catch (e) {
            console.log(`    Error: ${e.message.split('\n')[0]}`);
          }
          await modelPage.close();
          break; // Only visit first matching model
        }
      } catch {}
    }
  }

  // Phase 4: Visit all commission pages (the actual car configurators)
  console.log('\nPhase 4: Capturing commission/configurator pages...');
  const commissionUrls = [
    'https://www.rolls-roycemotorcars.com/en_GB/showroom/phantom-commission.html',
    'https://www.rolls-roycemotorcars.com/en_GB/showroom/phantom-extended-commission.html',
    'https://www.rolls-roycemotorcars.com/en_GB/showroom/spectre-commission.html',
    'https://www.rolls-roycemotorcars.com/en_GB/showroom/ghost-commission.html',
    'https://www.rolls-roycemotorcars.com/en_GB/showroom/ghost-extended-commission.html',
    'https://www.rolls-roycemotorcars.com/en_GB/showroom/cullinan-commission.html',
    'https://www.rolls-roycemotorcars.com/en_GB/showroom/black-badge-commission.html',
  ];

  for (let i = 0; i < commissionUrls.length; i++) {
    const url = commissionUrls[i];
    const name = url.split('/').pop().replace('.html', '');
    console.log(`  [${i + 1}/${commissionUrls.length}] ${name}...`);

    const commPage = await context.newPage();
    setupResponseCapture(commPage);

    try {
      await commPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await commPage.waitForTimeout(4000);

      // Accept cookies
      try {
        const btn = commPage.locator('[data-testid="uc-accept-all-button"], .cmm-cookie-banner__btn--accept');
        if (await btn.first().isVisible({ timeout: 1500 })) {
          await btn.first().click();
          await commPage.waitForTimeout(500);
        }
      } catch {}

      // Check for iframe/canvas
      const commInfo = await commPage.evaluate(() => ({
        title: document.title,
        hasIframe: !!document.querySelector('iframe'),
        iframeSrc: document.querySelector('iframe')?.src || null,
        hasCanvas: !!document.querySelector('canvas'),
        configEls: document.querySelectorAll('[class*="config"], [class*="color"], [class*="option"], [class*="selector"], [class*="swatch"]').length,
      }));

      console.log(`    Title: ${commInfo.title}`);
      console.log(`    Iframe: ${commInfo.hasIframe}${commInfo.iframeSrc ? ' → ' + commInfo.iframeSrc.slice(0, 100) : ''}`);
      console.log(`    Canvas: ${commInfo.hasCanvas}, Config elements: ${commInfo.configEls}`);

      await commPage.screenshot({ path: join(SCREENSHOTS_DIR, `20-commission-${name}.png`), fullPage: false });

      // If there's a configurator iframe, capture it deeply
      if (commInfo.hasIframe && commInfo.iframeSrc) {
        console.log(`    Capturing iframe: ${commInfo.iframeSrc.slice(0, 100)}`);
        const iPage = await context.newPage();
        setupResponseCapture(iPage);
        try {
          await iPage.goto(commInfo.iframeSrc, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await iPage.waitForTimeout(10000);
          await iPage.screenshot({ path: join(SCREENSHOTS_DIR, `21-commission-iframe-${name}.png`), fullPage: false });

          // Explore the configurator — look for color/option selectors
          const cfgDetails = await iPage.evaluate(() => ({
            title: document.title,
            hasCanvas: !!document.querySelector('canvas'),
            buttons: [...document.querySelectorAll('button, [role="button"], [role="tab"], [class*="tab"]')]
              .map(b => b.textContent?.trim().slice(0, 60)).filter(t => t && t.length < 60).slice(0, 30),
            swatches: document.querySelectorAll('[class*="swatch"], [class*="color"], [class*="paint"], [class*="option"]').length,
            tabs: [...document.querySelectorAll('[role="tab"], [class*="tab"], .nav-item')].map(t => t.textContent?.trim()).filter(Boolean).slice(0, 10),
          }));
          console.log(`      Iframe title: ${cfgDetails.title}`);
          console.log(`      Canvas: ${cfgDetails.hasCanvas}, Swatches: ${cfgDetails.swatches}`);
          if (cfgDetails.tabs.length) console.log(`      Tabs: ${cfgDetails.tabs.join(' | ')}`);
          if (cfgDetails.buttons.length) console.log(`      Buttons: ${cfgDetails.buttons.slice(0, 10).join(' | ')}`);

          // Try clicking through configurator tabs/sections
          for (const tabSelector of ['[role="tab"]', '[class*="tab"]', '.nav-item']) {
            const tabs = await iPage.locator(tabSelector).all();
            if (tabs.length > 1) {
              console.log(`      Clicking through ${tabs.length} tabs...`);
              for (let t = 0; t < Math.min(tabs.length, 8); t++) {
                try {
                  await tabs[t].click();
                  await iPage.waitForTimeout(3000);
                  await iPage.screenshot({ path: join(SCREENSHOTS_DIR, `22-cfg-tab-${name}-${t}.png`), fullPage: false });
                } catch {}
              }
              break;
            }
          }

          // Save iframe HTML
          const iHtml = await iPage.content();
          const iUrl = new URL(commInfo.iframeSrc);
          const iPath = join(OUTPUT_DIR, iUrl.hostname.replace(/[^a-zA-Z0-9.-]/g, '_'), iUrl.pathname || `commission-${name}.html`);
          await mkdir(dirname(iPath), { recursive: true });
          await writeFile(iPath, iHtml, 'utf-8');

        } catch (e) {
          console.log(`      Iframe error: ${e.message.split('\n')[0]}`);
        }
        await iPage.close();
      }

      // Scroll and save page HTML
      const sh = await commPage.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y < sh; y += 540) {
        await commPage.evaluate((sy) => window.scrollTo(0, sy), y);
        await commPage.waitForTimeout(400);
      }
      await commPage.waitForTimeout(1000);

      const html = await commPage.content();
      const pathname = new URL(url).pathname;
      const htmlPath = join(OUTPUT_DIR, 'www.rolls-roycemotorcars.com', pathname);
      await mkdir(dirname(htmlPath), { recursive: true });
      await writeFile(htmlPath, html, 'utf-8');

    } catch (e) {
      console.log(`    Error: ${e.message.split('\n')[0]}`);
    }
    await commPage.close();
  }

  // Save API manifest
  await writeFile(join(API_DIR, '_manifest.json'), JSON.stringify(apiResponses, null, 2), 'utf-8');

  await browser.close();

  console.log(`\n=== Real Configurator Capture Done ===`);
  console.log(`Resources: ${resourceCount}`);
  console.log(`API calls: ${apiResponses.length}`);
  console.log(`Screenshots: ${SCREENSHOTS_DIR}`);
})();
