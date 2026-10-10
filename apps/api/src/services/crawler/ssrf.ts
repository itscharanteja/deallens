import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export function isPublicAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(ip) === 6) {
    // Only globally routable unicast; excludes loopback, ULA, link-local and mapped IPv4.
    const first = parseInt(ip.split(':')[0], 16);
    const second = parseInt(ip.split(':')[1] || '0', 16);
    return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 &&
      !(first === 0x2001 && (second < 0x200 || second === 0xdb8));
  }
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 192 && b === 88 && c === 99) || (a === 203 && b === 0 && c === 113));
}

export function isSafeUrl(rawUrl: string): { safe: boolean; reason?: string } {
  try {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      return { safe: false, reason: 'Use an HTTP(S) URL without credentials.' };
    }
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
    if (host === 'localhost' || ['.localhost', '.local', '.internal'].some(s => host.endsWith(s)) ||
      (isIP(host) !== 0 && !isPublicAddress(host))) {
      return { safe: false, reason: 'Private and local network destinations are blocked.' };
    }
    if (url.port && !['80', '443'].includes(url.port)) return { safe: false, reason: 'Only public web ports are supported.' };
    return { safe: true };
  } catch {
    return { safe: false, reason: 'Malformed HTTP(S) URL.' };
  }
}

export type HostResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;
export async function resolveSafeTarget(rawUrl: string, resolver: HostResolver = host => lookup(host, { all: true })) {
  const result = isSafeUrl(rawUrl);
  if (!result.safe) throw new Error('SSRF_BLOCKED');
  const url = new URL(rawUrl);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await resolver(host);
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('SSRF_BLOCKED');
  return { url, address: addresses[0] };
}
