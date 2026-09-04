import { chromium } from 'playwright';
import { join } from 'path';

const BASE = 'http://localhost:3000';
const SCREENSHOTS = join(import.meta.dirname, 'verify-screenshots');
import { mkdir } from 'fs/promises';

(async () => {
  await mkdir(SCREENSHOTS, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  // 1. Homepage
  console.log('1. Checking homepage...');
  const home = await context.newPage();
  await home.goto(`${BASE}/en_GB/home.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await home.waitForTimeout(5000);

  const homeTitle = await home.title();
  console.log(`   Title: ${homeTitle}`);
  const homeImages = await home.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    let loaded = 0, broken = 0;
    imgs.forEach(img => {
      if (img.naturalWidth > 0) loaded++;
      else broken++;
    });
    return { total: imgs.length, loaded, broken };
  });
  console.log(`   Images: ${homeImages.total} total, ${homeImages.loaded} loaded, ${homeImages.broken} broken`);

  const homeHasNav = await home.locator('.global-menu-button, [class*="nav"], [class*="menu"]').count();
  console.log(`   Navigation elements: ${homeHasNav}`);

  const homeHasHero = await home.evaluate(() => {
    const h = document.querySelector('h1, h2, [class*="hero"]');
    return h ? h.textContent?.trim().slice(0, 80) : null;
  });
  console.log(`   Hero: ${homeHasHero}`);

  await home.screenshot({ path: join(SCREENSHOTS, '01-homepage.png'), fullPage: false });

  // Scroll
  const hh = await home.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < hh; y += 540) {
    await home.evaluate(sy => window.scrollTo(0, sy), y);
    await home.waitForTimeout(300);
  }
  await home.waitForTimeout(2000);
  await home.screenshot({ path: join(SCREENSHOTS, '01-homepage-full.png'), fullPage: true });
  console.log(`   Full page height: ${hh}px`);
  await home.close();

  // 2. Configure page
  console.log('\n2. Checking configure-your-rolls-royce...');
  const config = await context.newPage();
  await config.goto(`${BASE}/en_GB/bespoke/configure-your-rolls-royce.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await config.waitForTimeout(5000);

  const configTitle = await config.title();
  console.log(`   Title: ${configTitle}`);

  const configContent = await config.evaluate(() => {
    const h1 = document.querySelector('h1');
    const models = document.querySelectorAll('[class*="model"], article, .card, [class*="card"]');
    const links = [...document.querySelectorAll('a[href*="showroom"], a[href*="commission"]')].map(a => ({
      text: a.textContent?.trim().slice(0, 40),
      href: a.getAttribute('href'),
    }));
    const imgs = document.querySelectorAll('img');
    let loaded = 0;
    imgs.forEach(img => { if (img.naturalWidth > 0) loaded++; });
    return {
      h1: h1?.textContent?.trim(),
      modelElements: models.length,
      links: links.slice(0, 15),
      images: { total: imgs.length, loaded },
    };
  });
  console.log(`   H1: ${configContent.h1}`);
  console.log(`   Model elements: ${configContent.modelElements}`);
  console.log(`   Images: ${configContent.images.total} total, ${configContent.images.loaded} loaded`);
  console.log(`   Model/Commission links:`);
  configContent.links.forEach(l => console.log(`     "${l.text}" → ${l.href}`));

  await config.screenshot({ path: join(SCREENSHOTS, '02-configure.png'), fullPage: false });

  const ch = await config.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < ch; y += 540) {
    await config.evaluate(sy => window.scrollTo(0, sy), y);
    await config.waitForTimeout(300);
  }
  await config.waitForTimeout(2000);
  await config.screenshot({ path: join(SCREENSHOTS, '02-configure-full.png'), fullPage: true });
  await config.close();

  // 3. Commission page (Spectre)
  console.log('\n3. Checking Spectre commission page...');
  const spectre = await context.newPage();
  await spectre.goto(`${BASE}/en_GB/showroom/spectre-commission.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await spectre.waitForTimeout(5000);

  const spectreTitle = await spectre.title();
  console.log(`   Title: ${spectreTitle}`);
  const spectreContent = await spectre.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    let loaded = 0;
    imgs.forEach(img => { if (img.naturalWidth > 0) loaded++; });
    const videos = document.querySelectorAll('video');
    return {
      images: { total: imgs.length, loaded },
      videos: videos.length,
      bodyTextLength: document.body.innerText.length,
    };
  });
  console.log(`   Images: ${spectreContent.images.total} total, ${spectreContent.images.loaded} loaded`);
  console.log(`   Videos: ${spectreContent.videos}`);
  console.log(`   Body text: ${spectreContent.bodyTextLength} chars`);

  await spectre.screenshot({ path: join(SCREENSHOTS, '03-spectre-commission.png'), fullPage: false });

  const sh = await spectre.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < sh; y += 540) {
    await spectre.evaluate(sy => window.scrollTo(0, sy), y);
    await spectre.waitForTimeout(300);
  }
  await spectre.waitForTimeout(2000);
  await spectre.screenshot({ path: join(SCREENSHOTS, '03-spectre-full.png'), fullPage: true });
  await spectre.close();

  // 4. Showroom page
  console.log('\n4. Checking Showroom landing...');
  const showroom = await context.newPage();
  await showroom.goto(`${BASE}/en_GB/showroom.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await showroom.waitForTimeout(5000);
  console.log(`   Title: ${await showroom.title()}`);
  await showroom.screenshot({ path: join(SCREENSHOTS, '04-showroom.png'), fullPage: false });
  await showroom.close();

  // 5. Phantom page
  console.log('\n5. Checking Phantom model page...');
  const phantom = await context.newPage();
  await phantom.goto(`${BASE}/en_GB/showroom/phantom.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await phantom.waitForTimeout(5000);
  console.log(`   Title: ${await phantom.title()}`);
  const phantomImgs = await phantom.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    let loaded = 0;
    imgs.forEach(img => { if (img.naturalWidth > 0) loaded++; });
    return { total: imgs.length, loaded };
  });
  console.log(`   Images: ${phantomImgs.total} total, ${phantomImgs.loaded} loaded`);
  await phantom.screenshot({ path: join(SCREENSHOTS, '05-phantom.png'), fullPage: false });
  await phantom.close();

  await browser.close();

  console.log('\n=== Verification Complete ===');
  console.log(`Screenshots saved to: ${SCREENSHOTS}`);
})();
