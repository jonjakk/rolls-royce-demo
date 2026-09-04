import { chromium } from 'playwright';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { dirname, join, extname } from 'path';
import { createHash } from 'crypto';
import { URL } from 'url';
import { existsSync } from 'fs';

const BASE_URL = 'https://www.rolls-roycemotorcars.com';
const LOCALE = 'en_GB';
const OUTPUT_DIR = join(import.meta.dirname, 'site');
const STATE_FILE = join(import.meta.dirname, 'crawl-state.json');
const SITE_HOST = 'www.rolls-roycemotorcars.com';

const MAX_CONCURRENT = 3;
const PAGE_TIMEOUT = 45000;
const SCROLL_DELAY = 600;

const savedResources = new Map();
let resourceCount = 0;
let pagesCrawled = 0;

// --- URL helpers ---

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
    // Skip tracking/analytics endpoints
    const skipDomains = ['google-analytics.com', 'doubleclick.net', 'facebook.net', 'facebook.com', 'twitter.com', 'linkedin.com'];
    if (skipDomains.some(d => url.hostname.includes(d))) return false;
    return true;
  } catch { return false; }
}

function isInternalPage(urlStr) {
  try {
    const url = new URL(urlStr);
    return url.hostname === SITE_HOST && url.pathname.startsWith(`/${LOCALE}/`);
  } catch { return false; }
}

function normalizePageUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    url.hash = '';
    url.search = '';
    return url.toString();
  } catch { return urlStr; }
}

// --- Resource saving ---

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
  } catch (err) {
    // Silently skip errors
  }
}

// --- Page crawler ---

async function crawlPage(context, url, discoveredUrls) {
  const page = await context.newPage();
  const pageResources = [];

  page.on('response', async (response) => {
    const rUrl = response.url();
    if (!shouldCapture(rUrl)) return;
    try {
      const body = await response.body();
      await saveResource(rUrl, body);
    } catch {}
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
    // Brief wait for initial JS
    await page.waitForTimeout(2000);

    // Accept cookies if banner present
    try {
      const cookieBtn = page.locator('[data-testid="uc-accept-all-button"], .cmm-cookie-banner__btn--accept, #onetrust-accept-btn-handler');
      if (await cookieBtn.first().isVisible({ timeout: 1500 })) {
        await cookieBtn.first().click();
        await page.waitForTimeout(500);
      }
    } catch {}

    // Scroll to trigger lazy loading
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < scrollHeight; y += 540) {
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
      await page.waitForTimeout(SCROLL_DELAY);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);

    // Discover internal links
    const links = await page.evaluate((host) => {
      const anchors = document.querySelectorAll('a[href]');
      return [...anchors].map(a => a.href).filter(h => {
        try { return new URL(h).hostname === host; } catch { return false; }
      });
    }, SITE_HOST);

    for (const link of links) {
      const norm = normalizePageUrl(link);
      if (isInternalPage(norm)) {
        discoveredUrls.add(norm);
      }
    }

    // Get rendered HTML
    const html = await page.content();
    const pathname = new URL(url).pathname;
    let localHtmlPath;
    if (pathname === `/${LOCALE}/home.html`) {
      localHtmlPath = join(OUTPUT_DIR, 'index.html');
    } else {
      localHtmlPath = join(OUTPUT_DIR, SITE_HOST, pathname);
    }
    await mkdir(dirname(localHtmlPath), { recursive: true });
    await writeFile(localHtmlPath, html, 'utf-8');

    // Fetch images that lazy-load via data-src
    const lazySrcs = await page.evaluate(() => {
      const srcs = new Set();
      document.querySelectorAll('[data-src], [data-srcset], img[loading="lazy"]').forEach(el => {
        if (el.dataset?.src) srcs.add(el.dataset.src);
        if (el.src && el.src.startsWith('http')) srcs.add(el.src);
        if (el.dataset?.srcset) {
          el.dataset.srcset.split(',').forEach(s => {
            const u = s.trim().split(/\s+/)[0];
            if (u && u.startsWith('http')) srcs.add(u);
          });
        }
      });
      return [...srcs];
    });

    for (const src of lazySrcs) {
      if (!savedResources.has(src) && shouldCapture(src)) {
        try {
          const resp = await page.request.get(src);
          if (resp.ok()) await saveResource(src, await resp.body());
        } catch {}
      }
    }

  } catch (err) {
    console.log(`    [warn] Error on ${url}: ${err.message.split('\n')[0]}`);
  } finally {
    await page.close();
  }
}

// --- Sitemap fetcher ---

async function fetchSitemap(context) {
  const urls = new Set();
  const page = await context.newPage();
  try {
    const resp = await page.request.get(`${BASE_URL}/sitemap.xml`);
    if (resp.ok()) {
      const xml = await resp.text();
      // Extract <loc> entries
      const locRegex = /<loc>(.*?)<\/loc>/g;
      let match;
      while ((match = locRegex.exec(xml)) !== null) {
        const loc = match[1].trim();
        // Check for sitemap index (nested sitemaps)
        if (loc.endsWith('.xml')) {
          try {
            const subResp = await page.request.get(loc);
            if (subResp.ok()) {
              const subXml = await subResp.text();
              let subMatch;
              const subRegex = /<loc>(.*?)<\/loc>/g;
              while ((subMatch = subRegex.exec(subXml)) !== null) {
                const subLoc = subMatch[1].trim();
                if (subLoc.includes(`/${LOCALE}/`)) urls.add(normalizePageUrl(subLoc));
              }
            }
          } catch {}
        } else if (loc.includes(`/${LOCALE}/`)) {
          urls.add(normalizePageUrl(loc));
        }
      }
    }
  } catch (err) {
    console.log(`  [warn] Sitemap fetch failed: ${err.message}`);
  } finally {
    await page.close();
  }
  return urls;
}

// --- State management for resumability ---

async function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      const data = JSON.parse(await readFile(STATE_FILE, 'utf-8'));
      return { crawled: new Set(data.crawled || []), discovered: new Set(data.discovered || []) };
    }
  } catch {}
  return { crawled: new Set(), discovered: new Set() };
}

async function saveState(crawled, discovered) {
  await writeFile(STATE_FILE, JSON.stringify({
    crawled: [...crawled],
    discovered: [...discovered],
    timestamp: new Date().toISOString()
  }, null, 2), 'utf-8');
}

// --- Batch processor ---

async function processBatch(context, urls, discoveredUrls, crawledUrls) {
  const batch = urls.slice(0, MAX_CONCURRENT);
  await Promise.all(batch.map(async (url) => {
    if (crawledUrls.has(url)) return;
    crawledUrls.add(url);
    pagesCrawled++;
    const shortPath = new URL(url).pathname;
    console.log(`  [${pagesCrawled}] ${shortPath}`);
    await crawlPage(context, url, discoveredUrls);
  }));
}

// --- Main ---

(async () => {
  console.log('=== Full Site Mirror ===\n');

  const state = await loadState();
  const crawledUrls = state.crawled;
  const discoveredUrls = state.discovered;

  console.log(`Resuming: ${crawledUrls.size} already crawled, ${discoveredUrls.size} discovered\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-GB',
  });

  // Phase 1: Discover pages from sitemap
  console.log('Phase 1: Fetching sitemap...');
  const sitemapUrls = await fetchSitemap(context);
  console.log(`  Found ${sitemapUrls.size} URLs in sitemap`);
  for (const u of sitemapUrls) discoveredUrls.add(u);

  // Add known important pages that might not be in sitemap
  const knownPages = [
    `${BASE_URL}/${LOCALE}/home.html`,
    `${BASE_URL}/${LOCALE}/inspiring-greatness.html`,
    `${BASE_URL}/${LOCALE}/ownership/configurator.html`,
  ];
  for (const u of knownPages) discoveredUrls.add(normalizePageUrl(u));

  console.log(`  Total discovered: ${discoveredUrls.size} pages\n`);

  // Phase 2: Crawl all pages
  console.log('Phase 2: Crawling pages...');
  let iteration = 0;
  const maxIterations = 50; // safety limit

  while (iteration < maxIterations) {
    const pending = [...discoveredUrls].filter(u => !crawledUrls.has(u));
    if (pending.length === 0) break;

    iteration++;
    console.log(`\n  --- Iteration ${iteration}: ${pending.length} pages remaining ---`);

    for (let i = 0; i < pending.length; i += MAX_CONCURRENT) {
      const batch = pending.slice(i, i + MAX_CONCURRENT);
      await processBatch(context, batch, discoveredUrls, crawledUrls);

      // Save state periodically
      if (pagesCrawled % 10 === 0) {
        await saveState(crawledUrls, discoveredUrls);
      }
    }
  }

  // Final state save
  await saveState(crawledUrls, discoveredUrls);

  await browser.close();

  console.log(`\n=== Done ===`);
  console.log(`Pages crawled: ${pagesCrawled}`);
  console.log(`Resources saved: ${resourceCount}`);
  console.log(`\nTo serve locally:`);
  console.log(`  cd ${OUTPUT_DIR} && python3 -m http.server 3000`);
  console.log(`  Open: http://localhost:3000`);
})();
