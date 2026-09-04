import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';

const SITE_DIR = join(import.meta.dirname, 'site');
const HOST_DIR = join(SITE_DIR, 'www.rolls-roycemotorcars.com');

// GitHub Pages base path
const BASE = '/rolls-royce-demo';
const RR_BASE = `${BASE}/www.rolls-roycemotorcars.com`;

async function getAllHtmlFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      files.push(...await getAllHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function fixHtml(html, filePath) {
  let result = html;

  // 1) Inject combined-styles.css after <head> (or <head ...>) if not already present
  if (!result.includes('combined-styles.css')) {
    result = result.replace(
      /(<head[^>]*>)/i,
      `$1\n<link rel="stylesheet" href="${BASE}/combined-styles.css" type="text/css">`
    );
  }

  // 2) Rewrite absolute /etc.clientlibs/ paths to GitHub Pages paths
  //    These appear in href="...", src="...", and import("...") contexts
  //    Pattern: "/etc.clientlibs/..." or '/etc.clientlibs/...'
  result = result.replace(
    /(["'(])\/etc\.clientlibs\//g,
    `$1${RR_BASE}/etc.clientlibs/`
  );

  // 3) Rewrite absolute /etc/ paths (for non-clientlibs too, like /etc/...)
  //    But avoid double-rewriting paths already containing rolls-royce-demo
  result = result.replace(
    /(["'(])\/etc\//g,
    (match, prefix) => {
      // Don't rewrite if already rewritten
      if (match.includes('rolls-royce-demo')) return match;
      return `${prefix}${RR_BASE}/etc/`;
    }
  );

  // 4) Rewrite absolute /content/dam/ paths (images, videos)
  result = result.replace(
    /(["'(])\/content\/dam\//g,
    `$1${RR_BASE}/content/dam/`
  );

  // 5) Rewrite /content/rrmc/ navigation links
  //    These map to: /content/rrmc/marketUK/rollsroycemotorcars_com/en_GB/...
  //    We need to map them to the actual HTML files
  //    e.g. /content/rrmc/marketUK/rollsroycemotorcars_com/en_GB/showroom/phantom
  //    -> /rolls-royce-demo/www.rolls-roycemotorcars.com/en_GB/showroom/phantom.html
  result = result.replace(
    /href="\/content\/rrmc\/marketUK\/rollsroycemotorcars_com\/en_GB\/([^"]*?)"/g,
    (match, path) => {
      // Add .html extension if missing
      const htmlPath = path.endsWith('.html') ? path : `${path}.html`;
      return `href="${RR_BASE}/en_GB/${htmlPath}"`;
    }
  );

  // 6) Rewrite /en_GB/ navigation links
  result = result.replace(
    /href="\/en_GB\//g,
    `href="${RR_BASE}/en_GB/`
  );

  // 7) Rewrite /libs/ paths
  result = result.replace(
    /(["'(])\/libs\//g,
    `$1${RR_BASE}/libs/`
  );

  return result;
}

(async () => {
  console.log('=== Rolls-Royce Demo Site CSS Fix ===\n');

  // Process all HTML files under the www.rolls-roycemotorcars.com directory
  console.log('Finding HTML files...');
  const htmlFiles = await getAllHtmlFiles(HOST_DIR);
  console.log(`Found ${htmlFiles.length} HTML files in www.rolls-roycemotorcars.com/\n`);

  let modified = 0;
  let cssInjected = 0;
  let pathsFixed = 0;

  for (const filePath of htmlFiles) {
    try {
      const html = await readFile(filePath, 'utf-8');
      const newHtml = fixHtml(html, filePath);

      if (newHtml !== html) {
        await writeFile(filePath, newHtml, 'utf-8');
        modified++;

        if (!html.includes('combined-styles.css') && newHtml.includes('combined-styles.css')) {
          cssInjected++;
        }
        // Count path rewrites
        const oldAbsCount = (html.match(/["'(]\/etc\.clientlibs\//g) || []).length +
                            (html.match(/["'(]\/content\/dam\//g) || []).length +
                            (html.match(/href="\/en_GB\//g) || []).length +
                            (html.match(/href="\/content\/rrmc\//g) || []).length;
        if (oldAbsCount > 0) pathsFixed++;
      }
    } catch (err) {
      console.error(`Error: ${filePath}: ${err.message}`);
    }
  }

  // Also fix root-level HTML files
  const rootFiles = ['index.html', 'linkedin-retarget.html'];
  for (const rootFile of rootFiles) {
    const filePath = join(SITE_DIR, rootFile);
    try {
      const html = await readFile(filePath, 'utf-8');
      const newHtml = fixHtml(html, filePath);
      if (newHtml !== html) {
        await writeFile(filePath, newHtml, 'utf-8');
        modified++;
        console.log(`Fixed root file: ${rootFile}`);
      }
    } catch (err) {
      // File might not exist
    }
  }

  console.log(`\nResults:`);
  console.log(`  Files modified: ${modified}`);
  console.log(`  CSS injected: ${cssInjected} files`);
  console.log(`  Path fixes applied: ${pathsFixed} files`);
  console.log('\nDone!');
})();
