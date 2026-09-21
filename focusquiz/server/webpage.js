import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { extractFile, tidy, youtubeToText } from './extract.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });

// ---------- safety: never let a user-supplied link reach our own network ----------
export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) ||           // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224                              // multicast and reserved
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    if (v.startsWith('::ffff:')) return true;
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff'); // unique-local, link-local, multicast
  }
  return true;
}

// Checked at connection time, so a hostname that resolves to a private address is blocked too.
function safeLookup(hostname, options, cb) {
  if (typeof options === 'function') [cb, options] = [options, {}];
  dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) return cb(httpError(400, 'That address is not allowed.'));
    if (options.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}

export function normalizeUrl(input) {
  let s = String(input || '').trim();
  if (!s) throw httpError(400, 'Paste a link first.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  let url;
  try {
    url = new URL(s);
  } catch {
    throw httpError(400, 'That does not look like a web address.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw httpError(400, 'Only http and https links are supported.');
  if (url.username || url.password) throw httpError(400, 'Links with a username or password are not supported.');
  return url;
}

const MAX_HTML = 3 * 1024 * 1024;
const MAX_PDF = 10 * 1024 * 1024;

function request(url, { allowPrivate, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (!allowPrivate && net.isIP(host) && isPrivateAddress(host)) return reject(httpError(400, 'That address is not allowed.'));
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(
      url,
      {
        method: 'GET',
        timeout: timeoutMs,
        lookup: allowPrivate ? undefined : safeLookup,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; FocusQuiz/1.0)',
          accept: 'text/html,application/xhtml+xml,text/plain,application/pdf;q=0.8',
          'accept-encoding': 'identity'
        }
      },
      (res) => {
        const limit = /pdf/i.test(res.headers['content-type'] || '') ? MAX_PDF : MAX_HTML;
        const parts = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size > limit) return req.destroy(httpError(413, 'That page is too large.'));
          parts.push(c);
        });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts), url }));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(httpError(504, 'The page took too long to respond.')));
    req.on('error', reject);
    req.end();
  });
}

// Follows redirects by hand so every hop goes through the same safety checks.
export async function fetchPage(input, { allowPrivate = false, timeoutMs = 10000, maxRedirects = 3 } = {}) {
  let url = normalizeUrl(input);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    let res;
    try {
      res = await request(url, { allowPrivate, timeoutMs });
    } catch (err) {
      throw err.status ? err : httpError(502, 'Could not reach that page.');
    }
    const redirect = res.status >= 300 && res.status < 400 && res.headers.location;
    if (!redirect) return res;
    url = normalizeUrl(new URL(res.headers.location, url).href);
  }
  throw httpError(502, 'That link redirects too many times.');
}

// ---------- readable text ----------
export function articleFromHtml(html) {
  const { document } = parseHTML(html);
  let pageTitle = '';
  try {
    pageTitle = (document.title || '').trim();
  } catch {} // pages with no <html> element throw here
  let article = null;
  try {
    article = new Readability(document, { charThreshold: 200 }).parse();
  } catch {}
  let blocks = [];
  if (article && article.content) {
    const { document: doc } = parseHTML(`<div>${article.content}</div>`);
    blocks = [...doc.querySelectorAll('h1,h2,h3,h4,h5,p,li,blockquote,pre')]
      .filter((el) => !el.querySelector('p,li,blockquote,pre,h1,h2,h3,h4,h5'))
      .map((el) => el.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }
  return { title: (article && article.title) || pageTitle, text: blocks.join('\n\n') };
}

// Any link: YouTube goes to the transcript loader, everything else is fetched as a page or PDF.
export async function linkToText(input, options = {}) {
  const url = normalizeUrl(input);
  if (/(^|\.)(youtube\.com|youtu\.be)$/i.test(url.hostname)) return youtubeToText(url.href);

  const page = await fetchPage(url.href, options);
  if (page.status >= 400) {
    throw httpError(422, `The site answered with an error (${page.status}). It may block automated access or need a login.`);
  }
  const type = String(page.headers['content-type'] || '').toLowerCase();
  if (type.includes('application/pdf')) {
    const { text } = await extractFile({ originalname: 'linked.pdf', buffer: page.body });
    return { title: url.hostname, text };
  }
  if (type.startsWith('text/plain')) return { title: url.hostname, text: tidy(page.body.toString('utf8')) };
  if (!type.includes('html')) throw httpError(415, 'That link is not a web page or a PDF.');

  const { title, text } = articleFromHtml(page.body.toString('utf8'));
  const cleaned = tidy(text);
  if (cleaned.length < 200) {
    throw httpError(422, 'Not enough readable text on that page. It may need JavaScript or a login. Paste the text instead.');
  }
  return { title: title || url.hostname, text: cleaned };
}