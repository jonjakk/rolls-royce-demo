import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SITE_DIR = '/Users/jflach/projects/rolls-royce/mirror/site/www.rolls-roycemotorcars.com';
const CDN_TAG = '<script src="https://cdn.c360a.salesforce.com/beacon/c360a/f18ae63d-f94f-4a66-8c6e-bfc7a6cf4001/scripts/c360a.min.js"></script>';
const SITEMAP_TAG = '<script src="/rolls-royce-demo/rr-sitemap.js"></script>';
const INJECT_BLOCK = `${CDN_TAG}\n${SITEMAP_TAG}`;

async function findHtmlFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      const fullPath = join(entry.parentPath ?? entry.path, entry.name);
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const htmlFiles = await findHtmlFiles(SITE_DIR);
  console.log(`Found ${htmlFiles.length} HTML files in site directory`);

  let modified = 0;
  let skipped = 0;
  let alreadyInjected = 0;

  for (const filePath of htmlFiles) {
    let content = await readFile(filePath, 'utf-8');

    // Skip if already injected
    if (content.includes('c360a.min.js')) {
      alreadyInjected++;
      continue;
    }

    // Try to inject before </head>
    const headCloseIdx = content.lastIndexOf('</head>');
    if (headCloseIdx !== -1) {
      content = content.slice(0, headCloseIdx) + INJECT_BLOCK + '\n' + content.slice(headCloseIdx);
      await writeFile(filePath, content, 'utf-8');
      modified++;
    } else {
      // Fallback: inject after <head> or <head ...>
      const headOpenMatch = content.match(/<head[^>]*>/i);
      if (headOpenMatch) {
        const insertPos = headOpenMatch.index + headOpenMatch[0].length;
        content = content.slice(0, insertPos) + '\n' + INJECT_BLOCK + content.slice(insertPos);
        await writeFile(filePath, content, 'utf-8');
        modified++;
      } else {
        console.log(`  SKIPPED (no <head>): ${filePath}`);
        skipped++;
      }
    }
  }

  console.log(`\nResults:`);
  console.log(`  Modified: ${modified}`);
  console.log(`  Already injected: ${alreadyInjected}`);
  console.log(`  Skipped (no head): ${skipped}`);
  console.log(`  Total: ${htmlFiles.length}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
