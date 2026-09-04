import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const OUTPUT_DIR = join(import.meta.dirname, 'configurator-capture');

(async () => {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-GB',
  });

  const allRequests = [];
  const allResponses = [];

  const page = await context.newPage();

  // Log ALL network activity
  page.on('request', req => {
    allRequests.push({ url: req.url(), method: req.method(), type: req.resourceType() });
  });

  page.on('response', async resp => {
    const url = resp.url();
    const ct = resp.headers()['content-type'] || '';
    let bodySize = 0;
    try {
      const body = await resp.body();
      bodySize = body.length;
    } catch {}
    allResponses.push({ url, status: resp.status(), contentType: ct, size: bodySize });
  });

  // Go to a commission page (Spectre is a good test — newer model)
  console.log('Loading Spectre commission page...');
  await page.goto('https://www.rolls-roycemotorcars.com/en_GB/showroom/spectre-commission.html', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // Accept cookies
  try {
    const btn = page.locator('[data-testid="uc-accept-all-button"], .cmm-cookie-banner__btn--accept, #onetrust-accept-btn-handler, button:has-text("ACCEPT ALL")');
    if (await btn.first().isVisible({ timeout: 5000 })) {
      await btn.first().click();
      console.log('Accepted cookies');
      await page.waitForTimeout(2000);
    }
  } catch {}

  // Wait for page to fully load
  console.log('Waiting for page to settle...');
  await page.waitForTimeout(10000);

  // Check all frames
  const frames = page.frames();
  console.log(`\nFound ${frames.length} frames:`);
  for (const frame of frames) {
    console.log(`  Frame: ${frame.name() || '(unnamed)'} → ${frame.url()}`);
  }

  // Check for iframes in the DOM
  const iframeInfo = await page.evaluate(() => {
    const iframes = document.querySelectorAll('iframe');
    return [...iframes].map((iframe, i) => ({
      index: i,
      src: iframe.src,
      id: iframe.id,
      classes: iframe.className,
      width: iframe.width,
      height: iframe.height,
      style: iframe.style.cssText,
      visible: iframe.offsetWidth > 0 && iframe.offsetHeight > 0,
      contentUrl: (() => { try { return iframe.contentWindow?.location?.href; } catch { return 'cross-origin'; } })(),
    }));
  });
  console.log(`\nIframes in DOM: ${iframeInfo.length}`);
  iframeInfo.forEach(info => {
    console.log(`  #${info.index}: src="${info.src}" id="${info.id}" class="${info.classes}" visible=${info.visible} ${info.width}x${info.height}`);
    console.log(`    style: ${info.style}`);
    console.log(`    contentUrl: ${info.contentUrl}`);
  });

  // Check for any web components or shadow DOM configurator
  const shadowInfo = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    const shadowHosts = [...allEls].filter(el => el.shadowRoot);
    return {
      shadowHostCount: shadowHosts.length,
      shadowHosts: shadowHosts.map(h => ({ tag: h.tagName, id: h.id, classes: h.className })),
      customElements: [...new Set([...allEls].map(el => el.tagName).filter(t => t.includes('-')))],
    };
  });
  console.log(`\nShadow DOM hosts: ${shadowInfo.shadowHostCount}`);
  shadowInfo.shadowHosts.forEach(h => console.log(`  ${h.tag}#${h.id}.${h.classes}`));
  console.log(`Custom elements: ${shadowInfo.customElements.join(', ')}`);

  // Check for any configurator-related elements
  const configElements = await page.evaluate(() => {
    const selectors = [
      '[class*="configur"]', '[class*="commission"]', '[class*="builder"]',
      '[class*="selector"]', '[class*="swatch"]', '[class*="color"]',
      '[class*="option"]', '[class*="step"]', '[class*="wizard"]',
      '[class*="carousel"]', '[data-component]', '[data-module]',
      'canvas', 'video', '.vjs-tech',
    ];
    const results = {};
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        results[sel] = els.length;
      }
    }
    return results;
  });
  console.log('\nConfigurator-related elements:');
  Object.entries(configElements).forEach(([sel, count]) => {
    console.log(`  ${sel}: ${count}`);
  });

  // Check what scripts loaded
  const scripts = await page.evaluate(() => {
    return [...document.querySelectorAll('script[src]')].map(s => s.src).filter(s => !s.includes('google') && !s.includes('adobe'));
  });
  console.log(`\nRelevant scripts: ${scripts.length}`);
  scripts.forEach(s => console.log(`  ${s}`));

  // Take screenshot
  await page.screenshot({ path: join(OUTPUT_DIR, 'commission-page.png'), fullPage: false });
  console.log('\nScreenshot saved');

  // Look for the actual configurator content - scroll down
  console.log('\nScrolling to find configurator section...');
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < pageHeight; y += 300) {
    await page.evaluate(sy => window.scrollTo(0, sy), y);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(3000);

  // Check frames again after scrolling (lazy load might have triggered)
  const framesAfter = page.frames();
  console.log(`\nFrames after scroll: ${framesAfter.length}`);
  for (const frame of framesAfter) {
    const fUrl = frame.url();
    console.log(`  Frame: ${frame.name() || '(unnamed)'} → ${fUrl}`);
    if (fUrl && fUrl !== 'about:blank' && !fUrl.startsWith('javascript:')) {
      try {
        const fContent = await frame.content();
        console.log(`    Content length: ${fContent.length}`);
        console.log(`    Preview: ${fContent.slice(0, 200).replace(/\n/g, ' ')}`);
      } catch (e) {
        console.log(`    Cannot access: ${e.message.split('\n')[0]}`);
      }
    }
  }

  // Check for network requests to configurator-like endpoints
  const configRequests = allResponses.filter(r =>
    r.url.includes('configur') || r.url.includes('commission') ||
    r.url.includes('model') || r.url.includes('color') ||
    r.url.includes('option') || r.url.includes('vehicle') ||
    r.url.includes('builder') || r.url.includes('3d') ||
    r.url.includes('webgl') || r.url.includes('three')
  );
  console.log(`\nConfigurator-related network requests: ${configRequests.length}`);
  configRequests.forEach(r => console.log(`  [${r.status}] ${r.url.slice(0, 150)} (${r.contentType}) ${r.size}b`));

  // Save full network log
  await writeFile(join(OUTPUT_DIR, 'network-log.json'), JSON.stringify({
    requests: allRequests,
    responses: allResponses,
  }, null, 2));

  // Also check the configure-your-rolls-royce page
  console.log('\n\n=== Now checking configure-your-rolls-royce.html ===\n');
  await page.goto('https://www.rolls-roycemotorcars.com/en_GB/bespoke/configure-your-rolls-royce.html', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(10000);

  // Check what the page actually contains
  const configPageInfo = await page.evaluate(() => {
    const mainContent = document.querySelector('main, [role="main"], .content, #content, .page-content');
    const allText = document.body.innerText;
    const sections = [...document.querySelectorAll('section, [class*="section"]')].map(s => ({
      classes: s.className,
      text: s.innerText?.slice(0, 100)?.trim(),
      children: s.children.length,
    }));
    return {
      title: document.title,
      mainContentExists: !!mainContent,
      bodyTextLength: allText.length,
      bodyTextPreview: allText.slice(0, 500),
      sections: sections.slice(0, 10),
      allAnchors: [...document.querySelectorAll('a[href]')].map(a => ({
        href: a.href,
        text: a.textContent?.trim().slice(0, 40)
      })).filter(a => a.text.length > 0 && (a.href.includes('configur') || a.href.includes('commission') || a.href.includes('showroom'))),
    };
  });

  console.log(`Title: ${configPageInfo.title}`);
  console.log(`Body text length: ${configPageInfo.bodyTextLength}`);
  console.log(`Body text preview: ${configPageInfo.bodyTextPreview.slice(0, 300)}`);
  console.log(`\nRelevant links:`);
  configPageInfo.allAnchors.forEach(a => console.log(`  "${a.text}" → ${a.href}`));

  await page.screenshot({ path: join(OUTPUT_DIR, 'configure-page.png'), fullPage: true });

  // Scroll and check for model cards
  const scrollH = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < scrollH; y += 540) {
    await page.evaluate(sy => window.scrollTo(0, sy), y);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(3000);

  await page.screenshot({ path: join(OUTPUT_DIR, 'configure-page-scrolled.png'), fullPage: true });

  await browser.close();
  console.log('\nDone. Results in', OUTPUT_DIR);
})();
