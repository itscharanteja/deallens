import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }));
vi.mock('node:http', () => ({ request: mocks.request }));
vi.mock('node:https', () => ({ request: mocks.request }));
import { isSafeUrl, resolveSafeTarget } from '../services/crawler/ssrf';
import { safeRequest } from '../services/crawler/http';

function respond(status: number, body: string, location?: string, stalled = false) {
  mocks.request.mockImplementationOnce(() => {
    const incoming = Object.assign(new EventEmitter(), { statusCode: status, headers: { 'content-type': 'text/html', location }, destroy(error: Error) { incoming.emit('error', error); } });
    const request = Object.assign(new EventEmitter(), {
      destroy(error: Error) { request.emit('error', error); },
      end() { queueMicrotask(() => { request.emit('response', incoming); if (!stalled) { incoming.emit('data', Buffer.from(body)); incoming.emit('end'); } }); },
    });
    return request;
  });
}
beforeEach(() => { vi.clearAllMocks(); mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]); });
describe('Pinned outbound HTTP safety', () => {
  it('blocks IPv6 loopback, ULA, link-local and mapped loopback', () => {
    for (const host of ['[::1]', '[fd00::1]', '[fe80::1]', '[::ffff:127.0.0.1]']) expect(isSafeUrl(`http://${host}`).safe).toBe(false);
  });
  it('rejects a public hostname resolving to any private address', async () => {
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }]);
    await expect(resolveSafeTarget('https://public.example')).rejects.toThrow('SSRF_BLOCKED');
  });
  it('pins the verified address to the HTTP socket', async () => {
    respond(200, '<html>Public</html>');
    const response = await safeRequest('https://public.example');
    expect(response.status).toBe(200);
    const options = mocks.request.mock.calls[0][1];
    const callback = vi.fn(); options.lookup('public.example', {}, callback);
    expect(callback).toHaveBeenCalledWith(null, '93.184.216.34', 4);
  });
  it('blocks a redirect to private networks before connecting', async () => {
    respond(302, '', 'http://127.0.0.1');
    await expect(safeRequest('https://public.example')).rejects.toThrow('SSRF_BLOCKED');
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it('does not redirect a webhook payload', async () => {
    respond(307, '', 'https://elsewhere.example');
    await expect(safeRequest('https://public.example', { method: 'POST', body: '{}' })).rejects.toThrow('REDIRECT_BLOCKED');
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it('caps streamed bytes and times out stalled response bodies and DNS', async () => {
    respond(200, 'x'.repeat(100));
    await expect(safeRequest('https://public.example', { maxBytes: 10 })).rejects.toThrow('RESPONSE_TOO_LARGE');
    respond(200, '', undefined, true);
    await expect(safeRequest('https://public.example', { timeoutMs: 10 })).rejects.toThrow('CRAWL_TIMEOUT');
    mocks.lookup.mockImplementationOnce(() => new Promise(() => {}));
    await expect(safeRequest('https://public.example', { timeoutMs: 10 })).rejects.toThrow('CRAWL_TIMEOUT');
  });
});
