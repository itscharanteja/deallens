import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { resolveSafeTarget } from './ssrf';

export interface SafeHttpResponse { url: string; status: number; contentType: string; body: string; location?: string }
interface RequestOptions { method?: 'GET' | 'POST'; body?: string; timeoutMs?: number; maxBytes?: number; redirects?: number; deadline?: number }

/** DNS is validated once and pinned to the socket; every GET redirect is checked separately. */
export async function safeRequest(rawUrl: string, options: RequestOptions = {}): Promise<SafeHttpResponse> {
  const deadline = options.deadline ?? Date.now() + (options.timeoutMs ?? 5000);
  if (deadline <= Date.now()) throw new Error('CRAWL_TIMEOUT');
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const { url, address } = await Promise.race([
    resolveSafeTarget(rawUrl),
    new Promise<never>((_resolve, reject) => { dnsTimer = setTimeout(() => reject(new Error('CRAWL_TIMEOUT')), Math.max(1, deadline - Date.now())); }),
  ]).finally(() => clearTimeout(dnsTimer));
  const response = await new Promise<SafeHttpResponse>((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method: options.method ?? 'GET',
      agent: false,
      family: address.family,
      lookup: (_host, _options, callback) => callback(null, address.address, address.family),
      headers: {
        'User-Agent': 'DealLens/1.0 (public company research)',
        Accept: 'text/html,application/xhtml+xml',
        ...(options.body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(options.body) } : {}),
      },
    });
    const timer = setTimeout(() => request.destroy(new Error('CRAWL_TIMEOUT')), Math.max(1, deadline - Date.now()));
    request.on('error', error => { clearTimeout(timer); reject(error); });
    request.on('response', incoming => {
      const status = incoming.statusCode ?? 0;
      const contentType = incoming.headers['content-type'] ?? '';
      const location = incoming.headers.location;
      const chunks: Buffer[] = [];
      let bytes = 0;
      incoming.on('error', error => { clearTimeout(timer); reject(error); });
      incoming.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > (options.maxBytes ?? 2 * 1024 * 1024)) {
          incoming.destroy(new Error('RESPONSE_TOO_LARGE'));
          request.destroy(new Error('RESPONSE_TOO_LARGE'));
        } else chunks.push(chunk);
      });
      incoming.on('end', () => {
        clearTimeout(timer);
        resolve({ url: url.href, status, contentType, location, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    request.end(options.body);
  });
  if ([301, 302, 303, 307, 308].includes(response.status) && response.location) {
    // Never forward lead/contact payloads to a redirect destination.
    if (options.method === 'POST' || (options.redirects ?? 0) >= 3) throw new Error('REDIRECT_BLOCKED');
    return safeRequest(new URL(response.location, url).href, { ...options, deadline, redirects: (options.redirects ?? 0) + 1 });
  }
  return response;
}
