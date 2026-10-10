'use client';
import { useState, useEffect } from 'react';
import { Drawer, Button, Badge, Tabs, Accordion, ActionIcon, Alert, Tooltip, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconExternalLink, IconCopy, IconDownload, IconChevronLeft, IconChevronRight, IconArrowUpRight, IconInfoCircle, IconRefresh, IconCheck } from '@tabler/icons-react';
import { EnrichedCompanyResult, FIT_WEIGHTS, ACTION_THRESHOLDS, createBrief, safeWebsite } from '@deallens/shared';
import { BucketBadge } from './DealQueueTable';
import { downloadText } from '@/lib/download';

interface Props {
  opened: boolean; onClose: () => void; item: EnrichedCompanyResult | null;
  onEnrichCompany: (id: string) => Promise<void>; isEnriching: boolean; enrichmentError?: string;
  onNextCompany: () => void; onPrevCompany: () => void; position: number; total: number;
  initialTab?: string;
}
const fitLabels: Record<keyof typeof FIT_WEIGHTS, string> = { industry: 'Industry', geography: 'Geography', revenue: 'Revenue', employees: 'Team size', age: 'Business age', founderLed: 'Founder-led', independent: 'Independent ownership' };
export function CompanyDrawer({ opened, onClose, item, onEnrichCompany, isEnriching, enrichmentError, onNextCompany, onPrevCompany, position, total, initialTab = 'overview' }: Props) {
  const [tab, setTab] = useState<string | null>(initialTab);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!opened) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';
      if (isInput) return;

      if (e.key === 'ArrowLeft' || e.key === 'k' || e.key === 'K') {
        if (position > 0 && !isEnriching) {
          e.preventDefault();
          onPrevCompany();
        }
      } else if (e.key === 'ArrowRight' || e.key === 'j' || e.key === 'J') {
        if (position >= 0 && position < total - 1 && !isEnriching) {
          e.preventDefault();
          onNextCompany();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opened, position, total, isEnriching, onNextCompany, onPrevCompany]);

  if (!item) return null;
  const { company: c, analysis: a } = item;
  const demo = c.dataSource === 'demo';
  const brief = createBrief(item);
  const copyBrief = async () => {
    try { await navigator.clipboard.writeText(brief); setCopied(true); notifications.show({ title: 'Research brief copied', message: 'Includes source links, unknowns, and the next research action.', color: 'teal' }); }
    catch { setTab('brief'); notifications.show({ title: 'Clipboard unavailable', message: 'Select the brief text below, or download it as a Markdown file.', color: 'orange' }); }
  };
  const failed = ['TIMEOUT', 'FAILED', 'BLOCKED_OR_UNAVAILABLE'].includes(c.crawlStatus);
  return <Drawer closeButtonProps={{ 'aria-label': 'Close company research' }} opened={opened} onClose={onClose} position="right" size="720px" title={<span className="text-sm font-medium text-stone-600">Company research <span className="text-stone-400 mx-2">/</span> {position < 0 ? 'Outside current filters' : `${position + 1} of ${total} in current view`}</span>} padding="lg" classNames={{ body: 'research-drawer-body', header: 'research-drawer-header' }}>
    <div className="p-5 sm:p-7">
      <div className="flex justify-between items-start gap-4"><div><div className="flex gap-2 mb-3"><BucketBadge bucket={a.actionBucket} /><Badge variant="light" color="gray">{demo ? 'Demo fixture' : c.dataSource === 'live' ? 'Website researched' : 'Imported lead'}</Badge></div><h2 className="text-2xl font-semibold tracking-tight mt-0 mb-2">{c.name}</h2><p className="text-sm text-stone-500 m-0">{c.industry} · {c.location || 'Location unknown'}</p></div><div className="flex gap-1 shrink-0"><Tooltip label="Previous target (← or K)" withArrow><ActionIcon aria-label="Previous company in current view" variant="default" size="lg" disabled={position <= 0 || isEnriching} onClick={onPrevCompany}><IconChevronLeft size={17} /></ActionIcon></Tooltip><Tooltip label="Next target (→ or J)" withArrow><ActionIcon aria-label="Next company in current view" variant="default" size="lg" disabled={position < 0 || position >= total - 1 || isEnriching} onClick={onNextCompany}><IconChevronRight size={17} /></ActionIcon></Tooltip></div></div>
      <div className="my-5"><Alert variant="light" color={demo ? 'gray' : 'teal'} icon={<IconInfoCircle size={17} />}>{demo ? 'Illustrative company data and sample evidence. These records have not been verified against live websites.' : 'Company details came from your CSV and remain unverified. Website snippets support research; they do not establish ownership or intent to sell.'}</Alert></div>
      <div className="grid grid-cols-3 gap-3 mb-5">{[{ label: 'Acquisition fit', value: a.fitScore, caption: 'Match to your criteria' }, { label: 'Owner signal', value: a.ownerSignalScore, caption: 'Ownership indicators' }, { label: 'Confidence', value: a.confidenceScore, caption: 'Public evidence support' }].map(s => <div className="score-card" key={s.label}><p className="text-xs sm:text-sm text-stone-600 m-0">{s.label}</p><p className="text-2xl sm:text-3xl font-semibold my-2 tabular-nums">{s.value}<span className="text-xs text-stone-400 font-normal"> /100</span></p><p className="text-xs text-stone-500 m-0">{s.caption}</p></div>)}</div>
      <div className="next-action-card"><div className="flex items-center gap-2 text-emerald-900 text-xs font-semibold uppercase tracking-wider"><IconArrowUpRight size={16} />Recommended next action</div><p className="text-sm leading-relaxed mb-0 mt-2">{a.recommendedAction}</p></div>
    </div>
    <Tabs value={tab} onChange={setTab} keepMounted={false}>
      <Tabs.List grow className="px-5 sm:px-7"><Tabs.Tab value="overview">Overview</Tabs.Tab><Tabs.Tab value="evidence">Evidence ({a.evidence.length})</Tabs.Tab><Tabs.Tab value="brief">Research brief</Tabs.Tab></Tabs.List>
      <Tabs.Panel value="overview" className="p-5 sm:p-7 space-y-6">
        <section><h3 className="section-title">Why this company</h3><p className="text-sm leading-relaxed text-stone-600">{a.summary}</p></section>
        <section><h3 className="section-title">Company details <span className="text-xs text-stone-500 font-normal">· {demo ? 'Sample data' : 'Reported, not verified'}</span></h3><dl className="detail-grid"><div><dt>Website</dt><dd>{safeWebsite(c.website) ? <a href={safeWebsite(c.website)!} target="_blank" rel="noreferrer" className="source-link">{c.normalizedDomain}<IconExternalLink size={13} /></a> : 'Unknown'}</dd></div><div><dt>Reported revenue</dt><dd>{c.revenue != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(c.revenue) : 'Unknown'}</dd></div><div><dt>Employees</dt><dd>{c.employees ?? 'Unknown'}</dd></div><div><dt>Founded</dt><dd>{c.foundedYear ?? 'Unknown'}</dd></div><div><dt>Contact</dt><dd>{c.contactName || 'Unknown'}{c.contactTitle && <span className="block text-xs font-normal text-stone-500 mt-1">{c.contactTitle}</span>}</dd></div><div><dt>Public email</dt><dd className="break-all">{c.contactEmail || 'Unknown'}</dd></div></dl></section>
        <Accordion variant="separated" radius="md"><Accordion.Item value="scores"><Accordion.Control>How these scores work</Accordion.Control><Accordion.Panel><p className="text-sm text-stone-600 mt-0">Fit measures alignment, owner signal measures research indicators, and confidence measures public evidence support. None is a probability of a sale.</p><div className="space-y-3">{Object.entries(FIT_WEIGHTS).map(([key, max]) => {
          const val = a.fitComponents[key as keyof typeof FIT_WEIGHTS];
          const pct = Math.min(100, Math.round((val / max) * 100));
          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs font-medium text-stone-700">
                <span>{fitLabels[key as keyof typeof FIT_WEIGHTS]}</span>
                <span className="tabular-nums text-stone-900">{val} <span className="text-stone-400 font-normal">/ {max} pts</span></span>
              </div>
              <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    pct >= 80 ? 'bg-emerald-600' : pct >= 50 ? 'bg-amber-600' : 'bg-stone-400'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}</div><p className="text-xs text-stone-500 leading-relaxed mt-4">Unknown fields can receive partial credit. Exclusion keywords override the fit total. Pursue now requires fit ≥ {ACTION_THRESHOLDS.pursueNow.minFit}, owner signal ≥ {ACTION_THRESHOLDS.pursueNow.minOwnerSignal}, and confidence ≥ {ACTION_THRESHOLDS.pursueNow.minConfidence}. Research owner requires fit ≥ {ACTION_THRESHOLDS.researchOwner.minFit}; monitor requires fit ≥ {ACTION_THRESHOLDS.monitor.minFit}.</p><p className="text-xs text-stone-500">Confidence uses fetched pages, distinct source URLs, evidence types and extraction quality. One source is capped at 50; conflicting ownership at 40; pending or failed checks at 20. Reported financials add no verification points. Multiple pages on one website are not independent corroboration.</p></Accordion.Panel></Accordion.Item></Accordion>
        <section className="unknowns-card"><h3 className="section-title">What still needs checking</h3><ul className="space-y-2 text-sm text-stone-700 pl-5 mb-0">{a.unknowns.map(u => <li key={u}>{u}</li>)}<li>Owner willingness to sell is unknown.</li></ul></section>
        <Button variant="default" fullWidth onClick={() => setTab('evidence')} rightSection={<IconArrowUpRight size={16} />}>Review supporting evidence</Button>
      </Tabs.Panel>
      <Tabs.Panel value="evidence" className="p-5 sm:p-7 space-y-4">
        <div><h3 className="section-title">Read the source, then decide</h3><p className="text-sm text-stone-500 leading-relaxed">Claims are extracted interpretations. Compare each one with the supporting quote and source before relying on it.</p></div>
        {(failed || c.crawlStatus === 'PENDING' || c.crawlStatus === 'PARTIAL') && <Alert color="yellow" title={failed ? 'Website unavailable' : c.crawlStatus === 'PENDING' ? 'Website has not been checked' : 'Some pages could not be reached'}>{demo ? 'This is a simulated research state in the demo.' : 'Evidence may be incomplete. Review the website manually or retry the check.'}</Alert>}
        {!a.evidence.length && <div className="empty-evidence"><IconSearchFallback /><h3 className="section-title mt-3">No supporting snippets yet</h3><p className="text-sm text-stone-500">{c.website ? 'Check the public website or research company ownership manually.' : 'No website was supplied. Requires manual research to identify the company’s public website.'}</p></div>}
        {a.evidence.map((e, i) => <article className="evidence-card" key={e.id}><div className="flex flex-wrap justify-between gap-2 mb-3"><span className="text-xs font-medium text-stone-500">SOURCE {String(i + 1).padStart(2, '0')} · {e.type.replaceAll('_', ' ').toLowerCase()}</span><Badge color="gray" variant="light" size="xs">{demo ? 'Sample evidence' : e.extractionMethod === 'llm' ? 'AI extraction' : e.extractionMethod === 'rule' ? 'Rule extraction' : 'Structured data'}</Badge></div><h4 className="text-sm font-semibold m-0">{e.claim}{e.polarity === 'conflicting' && <Badge color="orange" ml="sm">Conflicting evidence</Badge>}</h4><blockquote className="evidence-quote">“{e.snippet}”</blockquote><div className="flex flex-wrap items-center justify-between gap-2"><a className="source-link text-xs break-all" href={safeWebsite(e.sourceUrl) || undefined} target="_blank" rel="noreferrer">{demo ? 'Example source URL' : e.sourcePageTitle || 'Open source'}<IconExternalLink size={13} /></a><Tooltip label="Confidence in the extraction, not verification of the underlying claim"><span className="text-xs text-stone-500">Extraction confidence: {Math.round(e.confidence * 100)}%</span></Tooltip></div><p className="text-xs text-stone-500 break-all mt-2 mb-0">{e.sourceUrl}</p></article>)}
        {enrichmentError && <Alert color="red" title="Website check incomplete" role="alert">{enrichmentError}</Alert>}
        {!demo && <Button variant="default" fullWidth disabled={!safeWebsite(c.website)} loading={isEnriching} onClick={() => onEnrichCompany(c.id)} leftSection={<IconRefresh size={16} />}>{isEnriching ? 'Checking public pages…' : 'Check website for evidence'}</Button>}
        <p className="text-xs text-stone-500">{demo ? 'Import your own companies to check public websites.' : 'Checks up to 4 public pages. Unavailable pages remain marked as incomplete.'}</p>
      </Tabs.Panel>
      <Tabs.Panel value="brief" className="p-5 sm:p-7 space-y-4"><h3 className="section-title">Ready for your research notes</h3><p className="text-sm text-stone-500">A concise brief with scores, quotes, source URLs, and open questions.</p><Textarea label="Research brief (Markdown)" value={brief} readOnly autosize minRows={14} maxRows={24} styles={{ input: { fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7 } }} /><Button variant="default" onClick={() => downloadText(brief, `${c.normalizedDomain || 'company'}-brief.md`, 'text/markdown')} leftSection={<IconDownload size={16} />}>Download brief</Button></Tabs.Panel>
    </Tabs>
    <div className="drawer-footer"><Button variant="default" onClick={onClose}>Back to queue</Button><Button onClick={copyBrief} leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}>{copied ? 'Brief copied' : 'Copy research brief'}</Button></div>
  </Drawer>;
}
function IconSearchFallback() { return <IconInfoCircle size={28} className="text-stone-400" />; }
