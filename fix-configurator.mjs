import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, extname } from 'path';

const SITE = join(import.meta.dirname, 'site');
const PREFIX = '/rolls-royce-demo';

// URL replacements for HTML files
const HTML_REPLACEMENTS = [
  ['https://visualiser.rolls-roycemotorcars.com/', `${PREFIX}/visualiser.rolls-roycemotorcars.com/`],
  ['https://configure.rolls-roycemotorcars.com/', `${PREFIX}/configure.rolls-roycemotorcars.com/`],
  ['https://api.visualiser.rolls-roycemotorcars.com/', `${PREFIX}/api.visualiser.rolls-roycemotorcars.com/`],
  // Also handle without trailing slash (e.g., in JS string literals within HTML)
  ['https://visualiser.rolls-roycemotorcars.com"', `${PREFIX}/visualiser.rolls-roycemotorcars.com"`],
  ['https://configure.rolls-roycemotorcars.com"', `${PREFIX}/configure.rolls-roycemotorcars.com"`],
  ['https://api.visualiser.rolls-roycemotorcars.com"', `${PREFIX}/api.visualiser.rolls-roycemotorcars.com"`],
];

// URL replacements for JS files (the web component main.js has hardcoded API URLs)
const JS_REPLACEMENTS = [
  ['https://api.visualiser.rolls-roycemotorcars.com', `${PREFIX}/api.visualiser.rolls-roycemotorcars.com`],
  ['https://visualiser.rolls-roycemotorcars.com', `${PREFIX}/visualiser.rolls-roycemotorcars.com`],
  ['https://configure.rolls-roycemotorcars.com', `${PREFIX}/configure.rolls-roycemotorcars.com`],
];

// URL replacements for JSON settings files (configure domain uses /_proxy/ paths)
const JSON_REPLACEMENTS = [
  ['/_proxy/api.visualiser.rolls-roycemotorcars.com', `${PREFIX}/api.visualiser.rolls-roycemotorcars.com`],
  ['/_proxy/brochure.rolls-roycemotorcars.com', `${PREFIX}/brochure.rolls-roycemotorcars.com`],
  ['/_proxy/www.bmw.com', `${PREFIX}/www.bmw.com`],
];

// Recursively find files with given extensions
async function findFiles(dir, extensions) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findFiles(fullPath, extensions));
    } else if (extensions.includes(extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

function applyReplacements(content, replacements) {
  let result = content;
  for (const [from, to] of replacements) {
    // Avoid double-replacing if the target already contains the prefix
    if (!result.includes(to)) {
      result = result.replaceAll(from, to);
    } else {
      // Still replace remaining un-rewritten instances
      result = result.replaceAll(from, to);
    }
  }
  return result;
}

(async () => {
  console.log('=== Fix Configurator URLs ===\n');

  // 1. Fix HTML files
  console.log('1. Finding HTML files...');
  const htmlFiles = await findFiles(SITE, ['.html']);
  console.log(`   Found ${htmlFiles.length} HTML files`);

  let htmlModified = 0;
  const modifiedHtmlList = [];
  for (const filePath of htmlFiles) {
    const content = await readFile(filePath, 'utf-8');
    const updated = applyReplacements(content, HTML_REPLACEMENTS);
    if (updated !== content) {
      await writeFile(filePath, updated, 'utf-8');
      htmlModified++;
      modifiedHtmlList.push(filePath.replace(SITE + '/', ''));
    }
  }
  console.log(`   Modified ${htmlModified} HTML files:`);
  modifiedHtmlList.forEach(f => console.log(`     - ${f}`));

  // 2. Fix JS files in the web component (model-selection)
  console.log('\n2. Fixing web component JS files...');
  const modelSelDir = join(SITE, 'visualiser.rolls-roycemotorcars.com/web-component/model-selection');
  const jsFiles = await findFiles(modelSelDir, ['.js']);
  console.log(`   Found ${jsFiles.length} JS files in model-selection`);

  let jsModified = 0;
  for (const filePath of jsFiles) {
    const content = await readFile(filePath, 'utf-8');
    const updated = applyReplacements(content, JS_REPLACEMENTS);
    if (updated !== content) {
      await writeFile(filePath, updated, 'utf-8');
      jsModified++;
      console.log(`   Modified: ${filePath.replace(SITE + '/', '')}`);
    }
  }
  console.log(`   Modified ${jsModified} JS files`);

  // 3. Fix settings JSON files in configure domain
  console.log('\n3. Fixing configure domain settings...');
  const configureDir = join(SITE, 'configure.rolls-roycemotorcars.com');
  const jsonFiles = await findFiles(configureDir, ['.json']);
  console.log(`   Found ${jsonFiles.length} JSON files in configure domain`);

  let jsonModified = 0;
  for (const filePath of jsonFiles) {
    const content = await readFile(filePath, 'utf-8');
    const updated = applyReplacements(content, JSON_REPLACEMENTS);
    if (updated !== content) {
      await writeFile(filePath, updated, 'utf-8');
      jsonModified++;
      console.log(`   Modified: ${filePath.replace(SITE + '/', '')}`);
    }
  }
  console.log(`   Modified ${jsonModified} JSON files`);

  // Summary
  const total = htmlModified + jsModified + jsonModified;
  console.log(`\n=== Done: ${total} files modified total ===`);
  console.log(`   HTML: ${htmlModified}, JS: ${jsModified}, JSON: ${jsonModified}`);
})();
