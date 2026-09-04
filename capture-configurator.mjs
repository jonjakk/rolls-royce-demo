import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join, extname } from 'path';
import { createHash } from 'crypto';
import { URL } from 'url';

const CONFIGURATOR_URL = 'https://www.rolls-roycemotorcars.com/en_GB/ownership/configurator.html';
const OUTPUT_DIR = join(import.meta.dirname, 'site');
const API_DIR = join(OUTPUT_DIR, '_api');
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
      localPath = ext
        ? localPath.replace(ext, `_${hash}${ext}`)
        : localPath + `_${hash}`;
    }
    return localPath;
  } catch { return null; }
}

function shouldCapture(urlStr) {
  try {
    const url = new URL(urlStr);
    if (url.protocol === 'data:' || url.protocol === 'blob:') return false;
    const skipDomains = ['google-analytics.com', 'doubleclick.net', 'facebook.net', 'facebook.com'];
    if (skipDomains.some(d => url.hostname.includes(d))) return false;
    return true;
  } catch { return false; }
}

function isApiCall(urlStr) {
  try {
    const url = new URL(urlStr);
    const contentTypeIndicators = ['/api/', '/rest/', '/graphql', '/services/', '/configurator'];
    if (contentTypeIndicators.some(i => url.pathname.includes(i))) return true;
    if (url.pathname.endsWith('.json')) return true;
    if (url.searchParams.has('format') && url.searchParams.get('format') === 'json') return true;
    return false;
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
    if (resourceCount % 50 === 0) {
      console.log(`    [resources] ${resourceCount} saved`);
    }
  } catch {}
}

async function saveApiResponse(url, body, contentType, method) {
  const hash = createHash('md5').update(url).digest('hex').slice(0, 12);
  const ext = contentType?.includes('json') ? '.json' : contentType?.includes('xml') ? '.xml' : '.bin';
  const filename = `${hash}${ext}`;
  const filePath = join(API_DIR, filename);

  try {
    await mkdir(API_DIR, { recursive: true });
    await writeFile(filePath, body);
    apiResponses.push({ url, method, contentType, file: filename, size: body.length });
  } catch {}
}

(async () => {
  console.log('=== Configurator Capture ===\n');

  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  await mkdir(API_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-GB',
  });

  const page = await context.newPage();

  // Track all XHR/fetch requests for API interception
  const apiCallLog = [];

  page.on('response', async (response) => {
    const url = response.url();
    const request = response.request();
    const contentType = response.headers()['content-type'] || '';

    if (!shouldCapture(url)) return;

    try {
      const body = await response.body();

      // Save all resources
      await saveResource(url, body);

      // Additionally log API calls
      if (isApiCall(url) || contentType.includes('json') || request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
        await saveApiResponse(url, body, contentType, request.method());
      }
    } catch {}
  });

  // Phase 1: Load the configurator landing page
  console.log('Phase 1: Loading configurator...');
  try {
    await page.goto(CONFIGURATOR_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
  } catch (e) {
    console.log(`  Load note: ${e.message.split('\n')[0]}`);
  }

  // Accept cookies
  try {
    const cookieBtn = page.locator('[data-testid="uc-accept-all-button"], .cmm-cookie-banner__btn--accept, #onetrust-accept-btn-handler, button:has-text("Accept All"), button:has-text("ACCEPT ALL")');
    if (await cookieBtn.first().isVisible({ timeout: 3000 })) {
      await cookieBtn.first().click();
      console.log('  Accepted cookies');
      await page.waitForTimeout(1000);
    }
  } catch {}

  await page.screenshot({ path: join(SCREENSHOTS_DIR, '01-configurator-landing.png'), fullPage: false });
  console.log('  Screenshot: configurator landing');

  // Phase 2: Discover and interact with the configurator
  console.log('\nPhase 2: Exploring configurator...');

  // Check if the configurator has model selection
  const configContent = await page.evaluate(() => {
    return {
      title: document.title,
      hasIframe: !!document.querySelector('iframe'),
      iframeSrc: document.querySelector('iframe')?.src || null,
      hasCanvas: !!document.querySelector('canvas'),
      hasWebGL: !!document.querySelector('canvas[data-engine], canvas.webgl'),
      bodyClasses: document.body.className,
      mainContent: document.querySelector('main, [role="main"], .content, #content')?.innerHTML?.slice(0, 500) || '',
      allLinks: [...document.querySelectorAll('a[href*="configur"]')].map(a => ({ href: a.href, text: a.textContent.trim() })),
      allButtons: [...document.querySelectorAll('button, [role="button"], .btn, .cta')].map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 50),
    };
  });

  console.log(`  Page title: ${configContent.title}`);
  console.log(`  Has iframe: ${configContent.hasIframe}${configContent.iframeSrc ? ' → ' + configContent.iframeSrc : ''}`);
  console.log(`  Has canvas/WebGL: ${configContent.hasCanvas}/${configContent.hasWebGL}`);
  console.log(`  Configurator links found: ${configContent.allLinks.length}`);
  if (configContent.allLinks.length > 0) {
    configContent.allLinks.forEach(l => console.log(`    → ${l.text}: ${l.href}`));
  }
  console.log(`  Buttons found: ${configContent.allButtons.length}`);
  if (configContent.allButtons.length > 0) {
    configContent.allButtons.slice(0, 15).forEach(b => console.log(`    → "${b}"`));
  }

  // If configurator is in an iframe, navigate to it
  if (configContent.hasIframe && configContent.iframeSrc) {
    console.log(`\n  Configurator runs in iframe: ${configContent.iframeSrc}`);
    console.log('  Navigating to iframe URL directly...');

    const iframePage = await context.newPage();

    iframePage.on('response', async (response) => {
      const url = response.url();
      const request = response.request();
      const contentType = response.headers()['content-type'] || '';
      if (!shouldCapture(url)) return;
      try {
        const body = await response.body();
        await saveResource(url, body);
        if (isApiCall(url) || contentType.includes('json') || request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
          await saveApiResponse(url, body, contentType, request.method());
        }
      } catch {}
    });

    try {
      await iframePage.goto(configContent.iframeSrc, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await iframePage.waitForTimeout(8000);
      await iframePage.screenshot({ path: join(SCREENSHOTS_DIR, '02-configurator-iframe.png'), fullPage: false });
      console.log('  Screenshot: configurator iframe content');
    } catch (e) {
      console.log(`  Iframe load note: ${e.message.split('\n')[0]}`);
    }
    await iframePage.close();
  }

  // If there are model selection links/buttons, try clicking them
  const modelLinks = await page.locator('a[href*="configur"], a[href*="model"], [class*="model"] a, [class*="vehicle"] a, .configurator-model, [data-model]').all();
  if (modelLinks.length > 0) {
    console.log(`\n  Found ${modelLinks.length} model links, exploring each...`);
    for (let i = 0; i < Math.min(modelLinks.length, 8); i++) {
      try {
        const text = await modelLinks[i].textContent();
        const href = await modelLinks[i].getAttribute('href');
        console.log(`  Clicking model ${i + 1}: "${text?.trim()}" → ${href || 'no href'}`);
        await modelLinks[i].click();
        await page.waitForTimeout(5000);
        await page.screenshot({ path: join(SCREENSHOTS_DIR, `03-model-${i + 1}.png`), fullPage: false });
        console.log(`  Screenshot: model ${i + 1}`);
      } catch {}
    }
  }

  // Scroll the page to trigger any lazy-loaded configurator components
  console.log('\n  Scrolling page for lazy content...');
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < scrollHeight; y += 540) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2000);

  await page.screenshot({ path: join(SCREENSHOTS_DIR, '04-configurator-scrolled.png'), fullPage: true });
  console.log('  Screenshot: full page after scroll');

  // Phase 3: Try to find and navigate into the actual car configurator tool
  console.log('\nPhase 3: Looking for configurator entry points...');

  // Check for any "Start" or "Configure" CTAs
  const ctaSelectors = [
    'a:has-text("Configure")',
    'a:has-text("Start")',
    'a:has-text("Build")',
    'a:has-text("Design")',
    'button:has-text("Configure")',
    'button:has-text("Start")',
    '[class*="cta"]',
    '[class*="configure"]',
    '[data-action*="configure"]',
  ];

  for (const selector of ctaSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 1000 })) {
        const text = await el.textContent();
        const href = await el.getAttribute('href');
        console.log(`  Found CTA: "${text?.trim()}" (${selector})${href ? ' → ' + href : ''}`);

        if (href && href.startsWith('http')) {
          console.log(`  Navigating to: ${href}`);
          const configPage = await context.newPage();

          configPage.on('response', async (response) => {
            const url = response.url();
            const request = response.request();
            const contentType = response.headers()['content-type'] || '';
            if (!shouldCapture(url)) return;
            try {
              const body = await response.body();
              await saveResource(url, body);
              if (isApiCall(url) || contentType.includes('json') || request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
                await saveApiResponse(url, body, contentType, request.method());
              }
            } catch {}
          });

          try {
            await configPage.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await configPage.waitForTimeout(8000);
            await configPage.screenshot({ path: join(SCREENSHOTS_DIR, `05-config-cta-${selector.replace(/[^a-z]/g, '')}.png`), fullPage: false });

            // Explore the configurator tool
            const configToolContent = await configPage.evaluate(() => ({
              title: document.title,
              hasCanvas: !!document.querySelector('canvas'),
              hasWebGL: !!document.querySelector('canvas'),
              allButtons: [...document.querySelectorAll('button, [role="button"]')].map(b => b.textContent?.trim()).filter(Boolean).slice(0, 20),
            }));
            console.log(`    Title: ${configToolContent.title}`);
            console.log(`    Canvas/3D: ${configToolContent.hasCanvas}`);
            if (configToolContent.allButtons.length) {
              console.log(`    Buttons: ${configToolContent.allButtons.slice(0, 10).join(', ')}`);
            }

            // Scroll and capture
            const configScrollHeight = await configPage.evaluate(() => document.body.scrollHeight);
            for (let y = 0; y < configScrollHeight; y += 540) {
              await configPage.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
              await configPage.waitForTimeout(500);
            }
            await configPage.waitForTimeout(3000);
            await configPage.screenshot({ path: join(SCREENSHOTS_DIR, `06-config-tool-scrolled.png`), fullPage: true });

          } catch (e) {
            console.log(`    Load note: ${e.message.split('\n')[0]}`);
          }

          await configPage.close();
          break;
        }
      }
    } catch {}
  }

  // Phase 4: Capture all discovered page URLs from the configurator section
  console.log('\nPhase 4: Discovering configurator sub-pages...');
  const allHrefs = await page.evaluate(() => {
    return [...document.querySelectorAll('a[href]')].map(a => a.href)
      .filter(h => h.includes('rolls-roycemotorcars.com'))
      .filter(h => h.includes('configur') || h.includes('model') || h.includes('showroom'));
  });

  console.log(`  Found ${allHrefs.length} configurator/model related links:`);
  const uniqueHrefs = [...new Set(allHrefs)];
  for (const href of uniqueHrefs.slice(0, 20)) {
    console.log(`    → ${href}`);
  }

  // Visit each configurator-related page
  for (const href of uniqueHrefs) {
    try {
      const subPage = await context.newPage();
      subPage.on('response', async (response) => {
        const url = response.url();
        if (!shouldCapture(url)) return;
        try {
          const body = await response.body();
          await saveResource(url, body);
        } catch {}
      });

      await subPage.goto(href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await subPage.waitForTimeout(4000);

      // Scroll
      const sh = await subPage.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y < sh; y += 540) {
        await subPage.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
        await subPage.waitForTimeout(400);
      }
      await subPage.waitForTimeout(2000);

      // Save HTML
      const html = await subPage.content();
      const pathname = new URL(href).pathname;
      const htmlPath = join(OUTPUT_DIR, 'www.rolls-roycemotorcars.com', pathname);
      await mkdir(dirname(htmlPath), { recursive: true });
      await writeFile(htmlPath, html, 'utf-8');

      await subPage.close();
    } catch {}
  }

  // Save API response manifest
  await writeFile(join(API_DIR, '_manifest.json'), JSON.stringify(apiResponses, null, 2), 'utf-8');
  console.log(`\nAPI responses captured: ${apiResponses.length}`);

  await browser.close();

  console.log(`\n=== Configurator Capture Done ===`);
  console.log(`Resources saved: ${resourceCount}`);
  console.log(`API calls captured: ${apiResponses.length}`);
  console.log(`Screenshots in: ${SCREENSHOTS_DIR}`);
})();
