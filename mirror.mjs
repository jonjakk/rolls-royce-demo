import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join, extname } from 'path';
import { createHash } from 'crypto';
import { URL } from 'url';

const TARGET_URL = 'https://www.rolls-roycemotorcars.com/en_GB/home.html';
const OUTPUT_DIR = join(import.meta.dirname, 'site');
const ALLOWED_DOMAINS = [
  'www.rolls-roycemotorcars.com',
  'rolls-roycemotorcars.com',
  'assets.oneweb.mercedes-benz.com',
  'assets.rolls-roycemotorcars.com',
];

const savedResources = new Map();
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
      if (ext) {
        localPath = localPath.replace(ext, `_${hash}${ext}`);
      } else {
        localPath += `_${hash}`;
      }
    }
    return localPath;
  } catch {
    return null;
  }
}

function shouldCapture(urlStr) {
  try {
    const url = new URL(urlStr);
    if (url.protocol === 'data:') return false;
    // Capture from any domain - we need CDN assets too
    return true;
  } catch {
    return false;
  }
}

async function saveResource(url, body, contentType) {
  const localPath = urlToLocalPath(url);
  if (!localPath || savedResources.has(url)) return;
  savedResources.set(url, localPath);
  try {
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, body);
    resourceCount++;
    if (resourceCount % 20 === 0) {
      console.log(`  ... ${resourceCount} resources saved`);
    }
  } catch (err) {
    console.error(`  Failed to save ${url}: ${err.message}`);
  }
}

async function rewriteHtml(html, pageUrl) {
  let result = html;
  for (const [originalUrl, localPath] of savedResources) {
    try {
      const relPath = localPath.replace(OUTPUT_DIR + '/', '');
      const url = new URL(originalUrl);
      // Replace absolute URLs
      result = result.replaceAll(originalUrl, relPath);
      // Replace protocol-relative
      result = result.replaceAll(`//${url.host}${url.pathname}`, relPath);
      // Replace path-only references for same domain
      if (url.hostname === new URL(pageUrl).hostname) {
        result = result.replaceAll(`"${url.pathname}"`, `"${relPath}"`);
        result = result.replaceAll(`'${url.pathname}'`, `'${relPath}'`);
      }
    } catch {}
  }
  return result;
}

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-GB',
  });

  const page = await context.newPage();

  // Accept cookies automatically if dialog appears
  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  // Intercept all responses and save them
  page.on('response', async (response) => {
    const url = response.url();
    if (!shouldCapture(url)) return;
    try {
      const body = await response.body();
      const contentType = response.headers()['content-type'] || '';
      await saveResource(url, body, contentType);
    } catch {}
  });

  console.log(`Navigating to ${TARGET_URL}...`);
  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {
    console.log(`Initial load note: ${e.message}`);
    console.log('Continuing with what we have...');
  }

  // Handle cookie consent - click accept if present
  try {
    const cookieBtn = page.locator('[data-testid="uc-accept-all-button"], .cmm-cookie-banner__btn--accept, #onetrust-accept-btn-handler, [class*="cookie"] button, [class*="consent"] button');
    if (await cookieBtn.first().isVisible({ timeout: 3000 })) {
      await cookieBtn.first().click();
      console.log('Accepted cookie consent');
      await page.waitForTimeout(2000);
    }
  } catch {}

  // Scroll through the entire page to trigger lazy-loaded content
  console.log('Scrolling page to load lazy content...');
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = 1080;
  for (let y = 0; y < scrollHeight; y += viewportHeight / 2) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(800);
  }
  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2000);

  // Wait a bit more for any remaining assets
  console.log('Waiting for remaining assets...');
  await page.waitForTimeout(3000);

  // Get the fully rendered HTML
  console.log('Capturing rendered HTML...');
  const renderedHtml = await page.content();

  // Also capture all stylesheet content inline
  const allStyles = await page.evaluate(() => {
    const styles = [];
    for (const sheet of document.styleSheets) {
      try {
        const rules = Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
        styles.push(rules);
      } catch {}
    }
    return styles;
  });

  // Take a screenshot for reference
  await page.screenshot({ path: join(OUTPUT_DIR, 'reference-screenshot.png'), fullPage: true });
  console.log('Saved full-page reference screenshot');

  // Save the main HTML
  const rewrittenHtml = await rewriteHtml(renderedHtml, TARGET_URL);
  const mainHtmlPath = join(OUTPUT_DIR, 'index.html');
  await mkdir(dirname(mainHtmlPath), { recursive: true });
  await writeFile(mainHtmlPath, rewrittenHtml, 'utf-8');
  console.log(`Saved main HTML to index.html`);

  // Save combined styles
  if (allStyles.length > 0) {
    const combinedCss = allStyles.join('\n\n');
    await writeFile(join(OUTPUT_DIR, 'combined-styles.css'), combinedCss, 'utf-8');
    console.log('Saved combined computed styles');
  }

  // Capture all image sources that might have been missed
  const imageSrcs = await page.evaluate(() => {
    const srcs = new Set();
    document.querySelectorAll('img, source, [style*="background"]').forEach(el => {
      if (el.src) srcs.add(el.src);
      if (el.srcset) {
        el.srcset.split(',').forEach(s => {
          const url = s.trim().split(/\s+/)[0];
          if (url) srcs.add(url);
        });
      }
      if (el.dataset?.src) srcs.add(el.dataset.src);
      if (el.dataset?.srcset) {
        el.dataset.srcset.split(',').forEach(s => {
          const url = s.trim().split(/\s+/)[0];
          if (url) srcs.add(url);
        });
      }
    });
    return [...srcs];
  });

  console.log(`Found ${imageSrcs.length} image sources, fetching any missing...`);
  let extraFetched = 0;
  for (const src of imageSrcs) {
    if (!savedResources.has(src) && shouldCapture(src)) {
      try {
        const resp = await page.request.get(src);
        if (resp.ok()) {
          await saveResource(src, await resp.body(), resp.headers()['content-type'] || '');
          extraFetched++;
        }
      } catch {}
    }
  }
  if (extraFetched) console.log(`  Fetched ${extraFetched} additional images`);

  await browser.close();

  console.log(`\nDone! ${savedResources.size} total resources saved to ${OUTPUT_DIR}`);
  console.log(`\nTo serve locally, run:`);
  console.log(`  cd ${OUTPUT_DIR} && npx serve -p 3000`);
  console.log(`  or: cd ${OUTPUT_DIR} && python3 -m http.server 3000`);
  console.log(`\nThen open: http://localhost:3000`);
})();
