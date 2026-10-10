# Architecture

The Next.js App Router workspace uses Mantine for accessible interactions, Tailwind for composition and TanStack for the queue. Shared Zod schemas and pure functions own scoring, filtering, normalization, CSV and research reports. Components render and trigger operations.

The default demo is bundled and requires no API. Browser workspace snapshots (criteria, companies, evidence) are validated and stored locally after hydration; they are device-specific. Failed storage prompts exporting a backup.

Next.js proxies `/api/v1/*` to a Node Fastify service. Imports, thesis writes, explicit analysis, company research, briefs and exports are validated. Analysis runs retain a snapshot of their own companies and evidence. Unknown IDs return typed errors. Thirty POST requests per IP per minute bound single-instance abuse; no proxy header is trusted by default. Distributed abuse protection and authentication are deferred.

The crawler resolves DNS, rejects non-public IPv4/IPv6 results, pins the checked address to the socket and validates each redirect. Only HTTP(S) public web ports are supported. Streamed bytes and DNS/response/body time are bounded. Cheerio strips script/navigation noise and extracts conservative sentence-level evidence with stable page-specific IDs. It prioritizes discovered informative links within four pages, bounds domain concurrency with p-limit, and stops on access restrictions. A 24-hour, 500-entry memory cache avoids repeat research. HTML text alone cannot verify independent ownership or financials.

Supabase Postgres relational tables contain shared validated JSON snapshots. Startup awaits hydration; company, evidence, thesis, latest analysis and run snapshots are restored. Writes are awaited and returned database errors are reported in structured events and health metadata. Memory fallback remains usable but is explicitly reported. Snapshot migrations must be applied before live persistence. Raw full crawl pages are not persisted: only supporting snippets and URLs are retained, keeping storage and scope small. The browser does not automatically restore from the server store.

The active workflow is deterministic. Optional LLM helper code is not wired to routes; reports work without it. API briefs and CSV reuse shared serializers so fixture labels, unknowns, sources and spreadsheet formula safety match the browser.

Production deployment requires running the Next.js frontend with the Fastify API proxy configured via `API_BASE_URL`, backed by optional Supabase Postgres persistence.
