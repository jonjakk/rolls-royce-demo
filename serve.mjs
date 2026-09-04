import { createServer } from 'http';
import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join, extname, dirname } from 'path';
import { URL } from 'url';
import { execFile } from 'child_process';

const PORT = 3000;
const SITE_DIR = join(import.meta.dirname, 'site');
const HOST = 'www.rolls-roycemotorcars.com';

const PROXY_DOMAINS = [
  'api.visualiser.rolls-roycemotorcars.com',
  'visualiser.rolls-roycemotorcars.com',
  'configure.rolls-roycemotorcars.com',
  'brochure.rolls-roycemotorcars.com',
  'www.rolls-roycemotorcars.com',
  'www.bmw.com',
  'players.brightcove.net',
  'vjs.zencdn.net',
  'assets.adobedtm.com',
  'rollsroyce.germany-2.evergage.com',
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
  '.m3u8': 'application/x-mpegURL',
};

async function tryFile(filePath) {
  try {
    const s = await stat(filePath);
    if (s.isFile()) return filePath;
  } catch {}
  return null;
}

async function resolveLocalFile(urlPath) {
  const hostPath = join(SITE_DIR, HOST, urlPath);
  let found = await tryFile(hostPath);
  if (found) return found;
  found = await tryFile(hostPath + '.html');
  if (found) return found;
  found = await tryFile(join(hostPath, 'index.html'));
  if (found) return found;
  if (urlPath === '/' || urlPath === '/index.html') {
    found = await tryFile(join(SITE_DIR, HOST, '/en_GB/home.html'));
    if (found) return found;
  }
  return null;
}

// Use curl for proxying — Node https.request gets blocked by Akamai CDN
function curlProxy(targetHost, urlPath, search, req, res) {
  const fullUrl = `https://${targetHost}${urlPath}${search ? '?' + search : ''}`;
  console.log(`  PROXY -> ${fullUrl}`);

  const args = [
    '-s', '-L',
    '--connect-timeout', '15',
    '--max-time', '30',
    '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '-H', `Accept: ${req.headers.accept || '*/*'}`,
    '-H', 'Accept-Language: en-GB,en;q=0.9',
    '-H', `Origin: https://${HOST}`,
    '-H', `Referer: https://${HOST}/`,
    '-w', '\n%{content_type}\n%{http_code}',
    fullUrl,
  ];

  execFile('curl', args, { maxBuffer: 50 * 1024 * 1024, encoding: 'buffer' }, async (err, stdout) => {
    if (err) {
      console.log(`  PROXY ERR: ${err.message}`);
      if (!res.headersSent) { res.writeHead(502); res.end('Proxy error'); }
      return;
    }

    // Parse curl output: body + \n + content_type + \n + status_code
    const output = stdout;
    const lastNewline = output.lastIndexOf(0x0A);
    const secondLastNewline = output.lastIndexOf(0x0A, lastNewline - 1);

    const statusCode = parseInt(output.slice(lastNewline + 1).toString().trim()) || 200;
    const contentType = output.slice(secondLastNewline + 1, lastNewline).toString().trim() || 'application/octet-stream';
    let body = output.slice(0, secondLastNewline);

    // Rewrite text content
    const isText = contentType.includes('text/') || contentType.includes('javascript') || contentType.includes('json');
    if (isText) {
      let text = body.toString('utf-8');
      text = rewriteContent(text);
      body = Buffer.from(text, 'utf-8');
    }

    res.writeHead(statusCode, {
      'Content-Type': contentType,
      'Content-Length': body.length,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    res.end(body);

    // Cache locally
    if (statusCode === 200 && body.length > 0 && !contentType.includes('text/html')) {
      const cachePath = join(SITE_DIR, targetHost, urlPath);
      try {
        await mkdir(dirname(cachePath), { recursive: true });
        await writeFile(cachePath, body);
      } catch {}
    }
  });
}

function rewriteContent(text) {
  let result = text;
  // Main domain -> relative
  result = result.replaceAll(`https://${HOST}`, '');
  result = result.replaceAll(`http://${HOST}`, '');
  result = result.replaceAll(`//${HOST}`, '');
  // Other domains -> /_proxy/ routes (process longer domains first to avoid partial matches)
  for (const domain of PROXY_DOMAINS) {
    if (domain === HOST) continue;
    result = result.replaceAll(`https://${domain}`, `/_proxy/${domain}`);
    result = result.replaceAll(`http://${domain}`, `/_proxy/${domain}`);
    result = result.replaceAll(`"//${domain}`, `"/_proxy/${domain}`);
    result = result.replaceAll(`'//${domain}`, `'/_proxy/${domain}`);
  }
  return result;
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    let urlPath = decodeURIComponent(url.pathname);

    // Handle /_proxy/<domain>/... routes
    const proxyMatch = urlPath.match(/^\/_proxy\/([^/]+)(\/.*)/);
    if (proxyMatch) {
      const targetDomain = proxyMatch[1];
      const targetPath = proxyMatch[2];

      // Check local cache
      const cached = await tryFile(join(SITE_DIR, targetDomain, targetPath));
      if (cached) {
        let data = await readFile(cached);
        const ext = extname(cached).toLowerCase();
        let ct = MIME_TYPES[ext] || 'application/octet-stream';
        // Infer JSON for extensionless API files
        if (!ext) {
          try {
            const text = data.toString('utf-8').trim();
            if (text.startsWith('{') || text.startsWith('[')) ct = 'application/json';
          } catch {}
        }

        const isText = ct.includes('text/') || ct.includes('javascript') || ct.includes('json');
        if (isText) {
          data = Buffer.from(rewriteContent(data.toString('utf-8')), 'utf-8');
        }

        console.log(`  CACHE HIT: ${targetDomain}${targetPath} (${ct}, ${data.length}b)`);
        res.writeHead(200, {
          'Content-Type': ct,
          'Content-Length': data.length,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        });
        res.end(data);
        return;
      }

      curlProxy(targetDomain, targetPath, url.search.slice(1), req, res);
      return;
    }

    if (urlPath === '/' || urlPath === '/index.html') {
      urlPath = '/en_GB/home.html';
    }

    // Serve local file
    const filePath = await resolveLocalFile(urlPath);
    if (filePath) {
      let data = await readFile(filePath);
      const ext = extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      if (ext === '.html' || ext === '.js' || ext === '.json') {
        data = Buffer.from(rewriteContent(data.toString('utf-8')), 'utf-8');
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': data.length,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(data);
      return;
    }

    // Proxy to live RR site via curl
    curlProxy(HOST, urlPath, url.search.slice(1), req, res);
  } catch (err) {
    console.error('Request error:', err.message);
    if (!res.headersSent) { res.writeHead(500); res.end('Internal error'); }
  }
});

server.on('error', (err) => console.error('Server error:', err.message));
process.on('uncaughtException', (err) => console.error('Uncaught:', err.message));
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));

server.listen(PORT, () => {
  console.log(`\n  Rolls-Royce Mirror + Proxy Server`);
  console.log(`  ==================================`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  http://localhost:${PORT}/en_GB/home.html`);
  console.log(`  http://localhost:${PORT}/en_GB/bespoke/configure-your-rolls-royce.html`);
  console.log(`\n  Uses curl for proxying (bypasses Akamai CDN blocking)`);
  console.log(`  Press Ctrl+C to stop\n`);
});
