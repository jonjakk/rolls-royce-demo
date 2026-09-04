import { chromium } from 'playwright';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { dirname, join, extname } from 'path';
import { createHash } from 'crypto';
import { URL } from 'url';
import { existsSync } from 'fs';

const BASE_URL = 'https://www.rolls-roycemotorcars.com';
const OUTPUT_DIR = join(import.meta.dirname, 'site');
const SITE_HOST = 'www.rolls-roycemotorcars.com';
const PAGE_TIMEOUT = 30000;

const savedResources = new Map();
let resourceCount = 0;

// All pages discovered from the site-map page
const ALL_PAGES = [
  '/en_GB/bespoke/coachbuild-collection.html',
  '/en_GB/bespoke/coachbuild.html',
  '/en_GB/bespoke/coachbuild/amethyst-droptail.html',
  '/en_GB/bespoke/coachbuild/arcadia-droptail.html',
  '/en_GB/bespoke/coachbuild/boat-tail-the-next-chapter.html',
  '/en_GB/bespoke/coachbuild/coachbuild-sweptail.html',
  '/en_GB/bespoke/coachbuild/la-rose-noire-droptail.html',
  '/en_GB/bespoke/collection-cars/black-badge-cullinan-capella.html',
  '/en_GB/bespoke/collection-cars/black-badge-landspeed-collection.html',
  '/en_GB/bespoke/collection-cars/black-badge-neon-nights.html',
  '/en_GB/bespoke/collection-cars/black-badge-wraith-inception.html',
  '/en_GB/bespoke/collection-cars/dawn-silver-bullet.html',
  '/en_GB/bespoke/collection-cars/phantom-oribe.html',
  '/en_GB/bespoke/collection-cars/phantom-syntopia.html',
  '/en_GB/bespoke/collection-cars/phantom-tempus.html',
  '/en_GB/bespoke/collection-cars/wraith-black-arrow.html',
  '/en_GB/bespoke/collection-cars/wraith-kryptos-collection.html',
  '/en_GB/bespoke/configure-your-rolls-royce.html',
  '/en_GB/bespoke/craft.html',
  '/en_GB/bespoke/discover.html',
  '/en_GB/bespoke/inspiration.html',
  '/en_GB/bespoke/objects-of-luxury.html',
  '/en_GB/bespoke/private-collection-cars/black-badge-cullinan-blue-shadow.html',
  '/en_GB/bespoke/private-collection-cars/black-badge-ghost-ekleipsis.html',
  '/en_GB/boutique.html',
  '/en_GB/boutique/all-accessories.html',
  '/en_GB/boutique/bespoke-boutique.html',
  '/en_GB/boutique/lifestyle-collections.html',
  '/en_GB/dealers.html',
  '/en_GB/dealers/site-map.html',
  '/en_GB/home.html',
  '/en_GB/information/careers.html',
  '/en_GB/information/client-complaints-procedure.html',
  '/en_GB/information/contact-rolls-royce.html',
  '/en_GB/information/cookie-policy.html',
  '/en_GB/information/eu-battery-regulation.html',
  '/en_GB/information/legal-information.html',
  '/en_GB/information/pre-owned.html',
  '/en_GB/information/privacy-policy.html',
  '/en_GB/information/reach-campaign.html',
  '/en_GB/information/site-map.html',
  '/en_GB/information/sustainability.html',
  '/en_GB/inspiring-greatness.html',
  '/en_GB/inspiring-greatness/experience.html',
  '/en_GB/inspiring-greatness/experience/a-private-privilege.html',
  '/en_GB/inspiring-greatness/experience/dine-on-the-line.html',
  '/en_GB/inspiring-greatness/experience/festival-of-speed.html',
  '/en_GB/inspiring-greatness/experience/goodwood-revival.html',
  '/en_GB/inspiring-greatness/experience/in-the-artists-studio.html',
  '/en_GB/inspiring-greatness/objects.html',
  '/en_GB/inspiring-greatness/objects/arrive-in-style-icon-luggage-collection.html',
  '/en_GB/inspiring-greatness/objects/bespoke-craft-leather.html',
  '/en_GB/inspiring-greatness/objects/bespoke-craft-starlight-headliner.html',
  '/en_GB/inspiring-greatness/objects/bespoke-craft-technical-weave.html',
  '/en_GB/inspiring-greatness/objects/celestial-craftsmanship.html',
  '/en_GB/inspiring-greatness/objects/cellarette.html',
  '/en_GB/inspiring-greatness/objects/champagne-chest.html',
  '/en_GB/inspiring-greatness/objects/cocktail-hamper.html',
  '/en_GB/inspiring-greatness/objects/dawn-aero-cowling.html',
  '/en_GB/inspiring-greatness/objects/phantom-gallery.html',
  '/en_GB/inspiring-greatness/objects/phantom-suite.html',
  '/en_GB/inspiring-greatness/objects/phantom-tempus-champagne-chest.html',
  '/en_GB/inspiring-greatness/objects/picnic-hamper.html',
  '/en_GB/inspiring-greatness/objects/the-ultimate-accessory.html',
  '/en_GB/inspiring-greatness/objects/under-the-stars.html',
  '/en_GB/inspiring-greatness/values.html',
  '/en_GB/inspiring-greatness/values/a-greener-goodwood.html',
  '/en_GB/inspiring-greatness/values/a-vision-beyond-time.html',
  '/en_GB/inspiring-greatness/values/goodwood.html',
  '/en_GB/inspiring-greatness/values/how-rolls-met-royce.html',
  '/en_GB/inspiring-greatness/values/inspiring-greatness-series.html',
  '/en_GB/inspiring-greatness/values/masterpieces-in-miniature.html',
  '/en_GB/inspiring-greatness/values/the-lexicon-of-rolls-royce.html',
  '/en_GB/inspiring-greatness/values/the-spirit-of-ecstasy.html',
  '/en_GB/inspiring-greatness/vision.html',
  '/en_GB/inspiring-greatness/vision/103ex.html',
  '/en_GB/inspiring-greatness/vision/experimental-history.html',
  '/en_GB/inspiring-greatness/vision/introducing-black-badge-cullinan.html',
  '/en_GB/inspiring-greatness/visionaries.html',
  '/en_GB/inspiring-greatness/visionaries/forge-yellow.html',
  '/en_GB/inspiring-greatness/visionaries/serenitys-textile-maven.html',
  '/en_GB/inspiring-greatness/visionaries/the-making-of-boat-tail.html',
  '/en_GB/muse.html',
  '/en_GB/muse/muse-stories.html',
  '/en_GB/muse/muse-stories/2022-a-year-of-muse.html',
  '/en_GB/muse/muse-stories/art-in-360.html',
  '/en_GB/muse/muse-stories/art-of-perfection.html',
  '/en_GB/muse/muse-stories/cao-fei-blueprints.html',
  '/en_GB/muse/muse-stories/collecting-and-curating-media-art.html',
  '/en_GB/muse/muse-stories/commissions.html',
  '/en_GB/muse/muse-stories/dan-holdsworth.html',
  '/en_GB/muse/muse-stories/dominique-gonzalez-foerster-alienarium-5.html',
  '/en_GB/muse/muse-stories/generation-next.html',
  '/en_GB/muse/muse-stories/in-conversation-pamela-kramlich.html',
  '/en_GB/muse/muse-stories/inspiring-minds.html',
  '/en_GB/muse/muse-stories/jane-suitor-the-art-of-collecting.html',
  '/en_GB/muse/muse-stories/muse-the-rolls-royce-arts-programme.html',
  '/en_GB/muse/muse-stories/stones-against-diamonds.html',
  '/en_GB/muse/muse-stories/the-art-of-collecting.html',
  '/en_GB/muse/spirit-of-ecstasy-challenge.html',
  '/en_GB/muse/spirit-of-ecstasy-challenge/bi-rongrong-stitched-urban-skin.html',
  '/en_GB/muse/spirit-of-ecstasy-challenge/ghizlane-sahli-nissas-rina.html',
  '/en_GB/muse/spirit-of-ecstasy-challenge/moved-by-the-spirit.html',
  '/en_GB/muse/spirit-of-ecstasy-challenge/pushing-the-boundaries-of-textiles.html',
  '/en_GB/muse/spirit-of-ecstasy-challenge/reimagining-an-icon.html',
  '/en_GB/muse/spirit-of-ecstasy-challenge/scarlett-yang-transient-materiality.html',
  '/en_GB/muse/spirit-of-ecstasy-challenge/spirit-of-ecstasy-challenge-exhibition.html',
  '/en_GB/muse/spirit-of-ecstasy-challenge/spirit-of-ecstasy-winner-bi-rongrong.html',
  '/en_GB/muse/spirit-of-ecstasy-challenge/spirit-of-ecstasy-winner-ghizlane-sahli.html',
  '/en_GB/muse/spirit-of-ecstasy-challenge/spirit-of-ecstasy-winner-scarlett-yang.html',
  '/en_GB/muse/spirit-of-ecstasy-challenge/winners-announced.html',
  '/en_GB/muse/the-dream-commission.html',
  '/en_GB/muse/the-dream-commission/Dream-Commission-in-Venice.html',
  '/en_GB/muse/the-dream-commission/dream-commission-shortlist.html',
  '/en_GB/muse/the-dream-commission/dream-commission.html',
  '/en_GB/muse/the-dream-commission/history-of-moving-image-art-part-two.html',
  '/en_GB/muse/the-dream-commission/history-of-moving-image-art.html',
  '/en_GB/muse/the-dream-commission/looking-ahead-to-a-year-of-moving-image-art.html',
  '/en_GB/muse/the-dream-commission/muse-a-year-in-moving-image.html',
  '/en_GB/muse/the-dream-commission/pioneering-commissions.html',
  '/en_GB/muse/the-dream-commission/the-dream-commission-beatriz-santiago-munoz.html',
  '/en_GB/muse/the-dream-commission/the-dream-commission-martine-syms.html',
  '/en_GB/muse/the-dream-commission/the-dream-commission-sondra-perry.html',
  '/en_GB/muse/the-dream-commission/the-dream-commission-zhou-tao.html',
  '/en_GB/muse/the-dream-commission/the-inaugural-dream-commission.html',
  '/en_GB/muse/the-dream-commission/winners-dream-commission-life-in-dreams.html',
  '/en_GB/muse/the-dream-commission/winners-dream-commission.html',
  '/en_GB/muse/the-dream-commission/winners-preview.html',
  '/en_GB/muse/the-dream-commission/year-ahead-in-moving-image-art.html',
  '/en_GB/muse/the-dream-commission/year-in-moving-image-art.html',
  '/en_GB/ownership/charging.html',
  '/en_GB/ownership/configurator.html',
  '/en_GB/ownership/owners-lounge.html',
  '/en_GB/ownership/roadside-assistance.html',
  '/en_GB/ownership/technology-and-car-data.html',
  '/en_GB/ownership/whispers.html',
  '/en_GB/ownership/your-motor-car.html',
  '/en_GB/showroom.html',
  '/en_GB/showroom/black-badge-commission.html',
  '/en_GB/showroom/black-badge-cullinan.html',
  '/en_GB/showroom/black-badge-ghost.html',
  '/en_GB/showroom/black-badge.html',
  '/en_GB/showroom/cullinan-commission.html',
  '/en_GB/showroom/cullinan-in-detail.html',
  '/en_GB/showroom/cullinan.html',
  '/en_GB/showroom/ghost-commission.html',
  '/en_GB/showroom/ghost-extended-commission.html',
  '/en_GB/showroom/ghost-extended-in-detail.html',
  '/en_GB/showroom/ghost-extended.html',
  '/en_GB/showroom/ghost-in-detail.html',
  '/en_GB/showroom/ghost-prism.html',
  '/en_GB/showroom/ghost.html',
  '/en_GB/showroom/phantom-commission.html',
  '/en_GB/showroom/phantom-extended-commission.html',
  '/en_GB/showroom/phantom-extended-in-detail.html',
  '/en_GB/showroom/phantom-extended.html',
  '/en_GB/showroom/phantom-in-detail.html',
  '/en_GB/showroom/phantom.html',
  '/en_GB/showroom/spectre-commission.html',
  '/en_GB/showroom/spectre-in-detail.html',
  '/en_GB/showroom/spectre-in-motion.html',
  '/en_GB/showroom/spectre.html',
];

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
    const skip = ['google-analytics.com', 'doubleclick.net', 'facebook.net', 'facebook.com', 'twitter.com'];
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
  } catch {}
}

function alreadyCrawled(pagePath) {
  const localPath = join(OUTPUT_DIR, SITE_HOST, pagePath);
  return existsSync(localPath);
}

async function crawlPage(context, pagePath, index, total) {
  const url = `${BASE_URL}${pagePath}`;
  const page = await context.newPage();

  page.on('response', async (response) => {
    const rUrl = response.url();
    if (!shouldCapture(rUrl)) return;
    try {
      const body = await response.body();
      await saveResource(rUrl, body);
    } catch {}
  });

  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
    if (!resp || resp.status() >= 400) {
      console.log(`  [${index}/${total}] SKIP ${pagePath} (status ${resp?.status()})`);
      await page.close();
      return;
    }

    await page.waitForTimeout(2000);

    // Accept cookies
    try {
      const btn = page.locator('[data-testid="uc-accept-all-button"], .cmm-cookie-banner__btn--accept, #onetrust-accept-btn-handler');
      if (await btn.first().isVisible({ timeout: 1000 })) {
        await btn.first().click();
        await page.waitForTimeout(500);
      }
    } catch {}

    // Scroll to trigger lazy loading
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < scrollHeight; y += 800) {
      await page.evaluate((sy) => window.scrollTo(0, sy), y);
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    // Save HTML
    const html = await page.content();
    const htmlPath = join(OUTPUT_DIR, SITE_HOST, pagePath);
    await mkdir(dirname(htmlPath), { recursive: true });
    await writeFile(htmlPath, html, 'utf-8');

    // Fetch lazy images
    const lazySrcs = await page.evaluate(() => {
      const srcs = new Set();
      document.querySelectorAll('[data-src], [data-srcset], img').forEach(el => {
        if (el.dataset?.src) srcs.add(el.dataset.src);
        if (el.src && el.src.startsWith('http')) srcs.add(el.src);
      });
      return [...srcs];
    });
    for (const src of lazySrcs) {
      if (!savedResources.has(src) && shouldCapture(src)) {
        try {
          const r = await page.request.get(src, { timeout: 10000 });
          if (r.ok()) await saveResource(src, await r.body());
        } catch {}
      }
    }

    console.log(`  [${index}/${total}] OK ${pagePath} (${resourceCount} resources total)`);
  } catch (err) {
    console.log(`  [${index}/${total}] ERR ${pagePath}: ${err.message.split('\n')[0]}`);
  } finally {
    await page.close();
  }
}

(async () => {
  console.log('=== Crawl Remaining Pages ===\n');

  const remaining = ALL_PAGES.filter(p => !alreadyCrawled(p));
  console.log(`Total pages: ${ALL_PAGES.length}`);
  console.log(`Already crawled: ${ALL_PAGES.length - remaining.length}`);
  console.log(`Remaining: ${remaining.length}\n`);

  if (remaining.length === 0) {
    console.log('All pages already crawled!');
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-GB',
  });

  for (let i = 0; i < remaining.length; i++) {
    await crawlPage(context, remaining[i], i + 1, remaining.length);
  }

  await browser.close();

  const finalCount = ALL_PAGES.filter(p => alreadyCrawled(p)).length;
  console.log(`\n=== Done ===`);
  console.log(`Pages crawled: ${finalCount}/${ALL_PAGES.length}`);
  console.log(`Total resources: ${resourceCount}`);
})();
