import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, relative, dirname } from 'path';

const SITE_DIR = join(import.meta.dirname, 'site');
const HOST_DIR = join(SITE_DIR, 'www.rolls-roycemotorcars.com');

async function getAllHtmlFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('_')) {
      files.push(...await getAllHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

const DOMAIN_DIRS = new Map();

async function buildDomainMap() {
  const entries = await readdir(SITE_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('_')) {
      DOMAIN_DIRS.set(entry.name, join(SITE_DIR, entry.name));
    }
  }
}

function rewriteHtml(html, htmlFilePath) {
  let result = html;
  const htmlDir = dirname(htmlFilePath);

  for (const [domain, domainDir] of DOMAIN_DIRS) {
    const patterns = [
      `https://${domain}`,
      `http://${domain}`,
      `//${domain}`,
    ];
    for (const pattern of patterns) {
      const relPath = relative(htmlDir, domainDir);
      result = result.replaceAll(pattern, relPath || '.');
    }
  }

  // Fix paths that reference /content/dam/ (AEM DAM paths) - these are on the RR domain
  // /content/dam/... -> relative path to www.rolls-roycemotorcars.com/content/dam/...
  const rrDir = relative(htmlDir, join(SITE_DIR, 'www.rolls-roycemotorcars.com'));
  result = result.replaceAll('"/content/dam/', `"${rrDir}/content/dam/`);
  result = result.replaceAll("'/content/dam/", `'${rrDir}/content/dam/`);

  // Fix /etc.clientlibs/ paths
  result = result.replaceAll('"/etc.clientlibs/', `"${rrDir}/etc.clientlibs/`);
  result = result.replaceAll("'/etc.clientlibs/", `'${rrDir}/etc.clientlibs/`);
  result = result.replaceAll('"/etc/', `"${rrDir}/etc/`);
  result = result.replaceAll("'/etc/", `'${rrDir}/etc/`);

  // Fix /libs/ paths
  result = result.replaceAll('"/libs/', `"${rrDir}/libs/`);
  result = result.replaceAll("'/libs/", `'${rrDir}/libs/`);

  // Fix internal navigation links: /en_GB/... -> relative path
  result = result.replaceAll('href="/en_GB/', `href="${rrDir}/en_GB/`);

  return result;
}

(async () => {
  console.log('Building domain map...');
  await buildDomainMap();
  console.log(`Found ${DOMAIN_DIRS.size} domain directories`);

  console.log('Finding HTML files...');
  const htmlFiles = await getAllHtmlFiles(SITE_DIR);
  console.log(`Found ${htmlFiles.length} HTML files`);

  let rewritten = 0;
  for (const filePath of htmlFiles) {
    try {
      const html = await readFile(filePath, 'utf-8');
      const newHtml = rewriteHtml(html, filePath);
      if (newHtml !== html) {
        await writeFile(filePath, newHtml, 'utf-8');
        rewritten++;
      }
    } catch (err) {
      console.error(`Error: ${filePath}: ${err.message}`);
    }
  }

  console.log(`Rewrote ${rewritten}/${htmlFiles.length} HTML files`);

  // Also copy the index.html at root
  try {
    const indexPath = join(SITE_DIR, 'index.html');
    const indexHtml = await readFile(indexPath, 'utf-8');
    const newIndex = rewriteHtml(indexHtml, indexPath);
    await writeFile(indexPath, newIndex, 'utf-8');
    console.log('Rewrote root index.html');
  } catch {}

  console.log('Done!');
})();
