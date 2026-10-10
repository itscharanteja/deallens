'use client';
import { useMemo, useState, useEffect } from 'react';
import { Button, Badge, Modal, Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowRight,
  IconAdjustmentsHorizontal,
  IconMapPin,
  IconUsers,
  IconCurrencyDollar,
  IconInfoCircle,
  IconArrowUpRight,
  IconCheck,
} from '@tabler/icons-react';
import {
  DEFAULT_DEMO_THESIS,
  getDemoDataset,
  analyzeCompany,
  AcquisitionThesis,
  ActionBucket,
  EnrichedCompanyResult,
  CompanyWithPrecomputedEvidence,
  QueueFilters,
  QueueFiltersSchema,
  filterQueue,
  exportQueue,
  createDealBook,
  CsvImportResult,
  EnrichmentResponseSchema,
  WorkspaceSnapshotSchema,
} from '@deallens/shared';
import { Header } from '@/components/Header';
import { MetricsStrip } from '@/components/MetricsStrip';
import { DealQueueTable } from '@/components/DealQueueTable';
import { CompanyDrawer } from '@/components/CompanyDrawer';
import { ThesisDrawer } from '@/components/ThesisDrawer';
import { DemoTourModal } from '@/components/DemoTourModal';
import { CsvUploadModal } from '@/components/CsvUploadModal';
import { CrmPushModal } from '@/components/CrmPushModal';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';
import { downloadText } from '@/lib/download';

const demo = getDemoDataset();
const defaults = QueueFiltersSchema.parse({});
const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);

export default function HomePage() {
  const [workspaceRestored, setWorkspaceRestored] = useState(false);
  const [thesis, setThesis] = useState<AcquisitionThesis>(DEFAULT_DEMO_THESIS);
  const [dataset, setDataset] = useState<CompanyWithPrecomputedEvidence[]>(demo.validList);
  const [filters, setFilters] = useState<QueueFilters>(defaults);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [thesisOpen, setThesisOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [crmPushOpen, setCrmPushOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [enrichmentErrors, setEnrichmentErrors] = useState<Record<string, string>>({});
  const [importSummary, setImportSummary] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('deallens-workspace-v1');
      const snapshot = raw ? WorkspaceSnapshotSchema.safeParse(JSON.parse(raw)) : null;
      if (snapshot?.success) { setThesis(snapshot.data.thesis); setDataset(snapshot.data.dataset); }
    } catch { /* Storage may be unavailable; the offline demo remains usable. */ }
    setWorkspaceRestored(true);
  }, []);
  useEffect(() => {
    if (!workspaceRestored) return;
    try { localStorage.setItem('deallens-workspace-v1', JSON.stringify({ version: 1, thesis, dataset })); }
    catch { notifications.show({ id: 'storage-unavailable', title: 'Device storage unavailable', message: 'Export your workspace before refreshing; this browser could not save it.', color: 'orange' }); }
  }, [thesis, dataset, workspaceRestored]);

  const results = useMemo<EnrichedCompanyResult[]>(
    () =>
      dataset.map(({ company, evidence }) => ({
        company,
        analysis: analyzeCompany(company, thesis, evidence),
      })),
    [dataset, thesis]
  );

  const visible = useMemo(() => filterQueue(results, filters), [results, filters]);
  const selected = results.find(x => x.company.id === selectedId) || null;
  const position = visible.findIndex(x => x.company.id === selectedId);
  const industries = useMemo(
    () => Array.from(new Set(dataset.map(x => x.company.industry))).sort(),
    [dataset]
  );
  const companies = useMemo(() => dataset.map(x => x.company), [dataset]);

  const selectedCompanies = useMemo(
    () => results.filter(r => selectedIds.includes(r.company.id)),
    [results, selectedIds]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    const visibleIds = visible.map(v => v.company.id);
    setSelectedIds(prev => (visibleIds.every(id => prev.includes(id)) ? [] : visibleIds));
  };

  const clearSelection = () => setSelectedIds([]);

  // Global hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable;
      if (isInput) return;

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShortcutsOpen(prev => !prev);
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setCrmPushOpen(true);
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setThesisOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const counts = useMemo(() => {
    const buckets: Record<ActionBucket, number> = {
      PURSUE_NOW: 0,
      RESEARCH_OWNER: 0,
      MONITOR: 0,
      SKIP: 0,
    };
    results.forEach(x => buckets[x.analysis.actionBucket]++);
    return buckets;
  }, [results]);

  const importedCount = dataset.filter(x => x.company.dataSource !== 'demo').length;
  const updateFilters = (next: Partial<QueueFilters>) => setFilters(prev => ({ ...prev, ...next }));

  const openCompany = (item: EnrichedCompanyResult, tab = 'overview') => {
    setDrawerTab(tab);
    setSelectedId(item.company.id);
  };

  const exportCsv = (scope: 'filtered' | 'all' | 'selected') => {
    const rows =
      scope === 'selected'
        ? selectedCompanies
        : scope === 'filtered'
        ? visible
        : filterQueue(results, defaults);
    if (!rows.length) return;
    downloadText(
      exportQueue(rows),
      `deallens-${
        scope === 'selected'
          ? 'selected-leads'
          : scope === 'filtered'
          ? 'current-view'
          : 'all-companies'
      }.csv`
    );
    notifications.show({
      title: `${rows.length} companies exported`,
      message: 'CSV includes scores, evidence URLs, unknowns, and data-source labels.',
      color: 'teal',
      icon: <IconCheck size={17} />,
    });
  };

  const exportDealBook = (scope: 'selected' | 'filtered' | 'pursue_now') => {
    const rows =
      scope === 'selected'
        ? selectedCompanies
        : scope === 'filtered'
        ? visible
        : results.filter(x => x.analysis.actionBucket === 'PURSUE_NOW');
    if (!rows.length) {
      notifications.show({
        title: 'No candidates to compile',
        message: 'No candidates matched the selected scope for Deal Book compilation.',
        color: 'yellow',
      });
      return;
    }
    const bookTitle =
      scope === 'selected'
        ? `Selected Leads Deal Book (${rows.length} Targets)`
        : scope === 'filtered'
        ? `Filtered Queue Deal Book (${rows.length} Targets)`
        : `Pursue Now Acquisition Targets Deal Book (${rows.length} Targets)`;

    const mdContent = createDealBook(rows, thesis, bookTitle);
    const filename = `deallens-deal-book-${scope}-${new Date().toISOString().slice(0, 10)}.md`;
    downloadText(mdContent, filename);
    notifications.show({
      title: 'Deal Book compiled & downloaded',
      message: `${rows.length} candidates bundled into an executive Markdown dossier with triage matrix & evidence.`,
      color: 'teal',
      icon: <IconCheck size={17} />,
    });
  };

  const enrich = async (id: string) => {
    const record = dataset.find(x => x.company.id === id);
    if (!record || record.company.dataSource === 'demo' || enrichingId) return;
    setEnrichingId(id);
    setEnrichmentErrors(prev => ({ ...prev, [id]: '' }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65000);
    try {
      const response = await fetch(`/api/v1/companies/${encodeURIComponent(id)}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: record.company }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          'The research service is unavailable. Your existing evidence is unchanged. Retry later or check the website manually.'
        );
      const parsed = EnrichmentResponseSchema.safeParse(await response.json());
      if (!parsed.success)
        throw new Error(
          'The research service returned an unexpected response. Your existing evidence is unchanged.'
        );
      if (parsed.data.meta?.persistence === 'degraded') notifications.show({ title: 'Database save unavailable', message: 'Your research is retained on this device. Export a backup; the server could not confirm a database save.', color: 'orange' });
      const { company, evidence, crawlSummary } = parsed.data.data;
      setDataset(prev =>
        prev.map(x => (x.company.id === id ? { company, evidence } : x))
      );
      const failed = !['SUCCESS', 'PARTIAL'].includes(crawlSummary.status);
      if (failed)
        setEnrichmentErrors(prev => ({
          ...prev,
          [id]: 'The public website could not be reached. No new facts were verified. Retry later or review another public source.',
        }));
      notifications.show({
        title: failed
          ? 'Website could not be checked'
          : crawlSummary.status === 'PARTIAL'
          ? 'Website partially checked'
          : 'Website check complete',
        message: failed
          ? 'Existing evidence is retained. Manual research is needed.'
          : `${crawlSummary.pagesCrawled} pages read; ${evidence.length} supporting snippets available for review.`,
        color: failed || crawlSummary.status === 'PARTIAL' ? 'yellow' : 'teal',
      });
    } catch (e) {
      const message = controller.signal.aborted
        ? 'The website check took too long. Your existing evidence is unchanged. Try again later.'
        : e instanceof Error
        ? e.message
        : 'Website check failed. Please retry.';
      setEnrichmentErrors(prev => ({ ...prev, [id]: message }));
      notifications.show({ title: 'Website check incomplete', message, color: 'red' });
    } finally {
      clearTimeout(timeout);
      setEnrichingId(null);
    }
  };

  const saveThesis = (next: AcquisitionThesis) => {
    setThesis(next);
    notifications.show({
      title: 'Criteria applied',
      message: `All ${results.length} companies have been rescored. Your filters remain active.`,
      color: 'teal',
    });
  };

  const importCompanies = (result: CsvImportResult) => {
    setDataset(prev => [
      ...prev,
      ...result.companies.map(company => ({ company, evidence: [] })),
    ]);
    setFilters({ ...defaults, source: 'imported' });
    setUploadOpen(false);
    setImportSummary(
      `${result.companies.length} companies imported · ${result.duplicates} duplicates skipped · ${result.issues.length} rows with issues. Showing your imported leads.`
    );
  };

  const guideAction = (step: number) => {
    setTourOpen(false);
    if (step === 0) setThesisOpen(true);
    else if (step === 1)
      document.getElementById('queue-title')?.scrollIntoView({ block: 'start' });
    else if (visible[0]) openCompany(visible[0], step === 2 ? 'evidence' : 'brief');
  };

  return (
    <div className="min-h-screen">
      <Header
        onOpenUpload={() => setUploadOpen(true)}
        onOpenTour={() => setTourOpen(true)}
        onReset={() => setResetOpen(true)}
        onOpenCrmPush={() => setCrmPushOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
      <main
        id="main-content"
        className="mx-auto max-w-[1440px] px-4 sm:px-8 pb-10"
        tabIndex={-1}
      >
        <div className="workspace-hero">
          <div>
            <div className="eyebrow">ACQUISITION INTELLIGENCE</div>
            <h1 className="workspace-title">
              Find your next
              <br className="hidden lg:block" /> worthwhile conversation.
            </h1>
            <p className="text-sm leading-relaxed text-stone-500 max-w-md mb-5">
              Turn a list of companies into a focused research queue.
              <br className="hidden sm:block" /> Know what fits, what supports it, and what to
              check next.
            </p>
            <Button
              rightSection={<IconArrowRight size={16} />}
              onClick={() => visible[0] && openCompany(visible[0])}
              disabled={!visible.length}
            >
              Review {filters.sort === 'priority' ? 'top priority' : 'first company'}
            </Button>
            <Button
              ml="xs"
              variant="subtle"
              color="gray"
              onClick={() => setTourOpen(true)}
            >
              Quick walkthrough
            </Button>
          </div>
          <section className="thesis-card" aria-label="Active acquisition criteria">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="eyebrow">YOUR ACQUISITION CRITERIA</span>
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                leftSection={<IconAdjustmentsHorizontal size={15} />}
                onClick={() => setThesisOpen(true)}
              >
                Edit
              </Button>
            </div>
            <h2 className="text-lg font-semibold tracking-tight m-0 mb-3">
              {thesis.industry}
            </h2>
            <div className="flex flex-wrap gap-2">
              <span className="criteria-token">
                <IconMapPin size={14} />
                {thesis.geography}
              </span>
              <span className="criteria-token">
                <IconCurrencyDollar size={14} />
                {money(thesis.minRevenue)}–{money(thesis.maxRevenue)} revenue
              </span>
              <span className="criteria-token">
                <IconUsers size={14} />
                {thesis.minEmployees}–{thesis.maxEmployees} employees
              </span>
              <span className="criteria-token">{thesis.minBusinessAge}+ years operating</span>
            </div>
            <p className="text-xs text-stone-500 mb-0 mt-4">
              Scores update automatically when you apply new criteria.
            </p>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-y border-stone-200/80">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <Badge variant="light" color="gray" radius="sm">
              {importedCount ? 'Mixed workspace' : 'Demo workspace'}
            </Badge>
            <span>
              {demo.validCount} illustrative companies
              {importedCount ? ` · ${importedCount} imported` : ''} · No signup required
            </span>
          </div>
          <span className="text-xs text-stone-500 flex items-center gap-1.5">
            <IconInfoCircle size={14} />
            Demo evidence is sample data
          </span>
        </div>

        <nav aria-label="Research workflow" className="grid grid-cols-2 md:grid-cols-4 mt-3">
          <button className="workflow-step" onClick={() => setThesisOpen(true)}>
            <span className="step-number">1</span>Set acquisition criteria
            <IconArrowUpRight size={14} className="ml-auto text-stone-400" />
          </button>
          <a className="workflow-step" href="#queue-title">
            <span className="step-number">2</span>Focus your queue
            <IconArrowUpRight size={14} className="ml-auto text-stone-400" />
          </a>
          <button
            className="workflow-step disabled:opacity-40"
            disabled={!visible.length}
            onClick={() => visible[0] && openCompany(visible[0], 'evidence')}
          >
            <span className="step-number">3</span>Review the evidence
            <IconArrowUpRight size={14} className="ml-auto text-stone-400" />
          </button>
          <button
            className="workflow-step disabled:opacity-40"
            disabled={!visible.length}
            onClick={() => exportCsv('filtered')}
          >
            <span className="step-number">4</span>Export current view
            <IconArrowUpRight size={14} className="ml-auto text-stone-400" />
          </button>
        </nav>

        <MetricsStrip
          totalCount={results.length}
          bucketCounts={counts}
          selectedBucketFilter={filters.bucket}
          onSelectBucketFilter={bucket => updateFilters({ bucket })}
        />

        {importSummary && (
          <Alert mb="md" color="teal" withCloseButton onClose={() => setImportSummary(null)}>
            {importSummary}
          </Alert>
        )}

        <DealQueueTable
          companies={visible}
          totalCount={results.length}
          industries={industries}
          filters={filters}
          onFilters={updateFilters}
          onResetFilters={() => setFilters(defaults)}
          onSelectCompany={openCompany}
          onExport={exportCsv}
          onImport={() => setUploadOpen(true)}
          onOpenCrmPush={() => setCrmPushOpen(true)}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onClearSelection={clearSelection}
          onExportDealBook={exportDealBook}
        />

        <footer className="flex flex-wrap justify-between gap-3 py-5 text-xs text-stone-500">
          <span>Evidence before confidence. Research before outreach.</span>
          <span>
            {demo.duplicateCount} duplicate demo records removed · Workspace saved on this device
          </span>
        </footer>
      </main>

      {selected && (
        <CompanyDrawer
          key={selected.company.id}
          opened
          onClose={() => setSelectedId(null)}
          item={selected}
          initialTab={drawerTab}
          onEnrichCompany={enrich}
          isEnriching={enrichingId === selectedId}
          enrichmentError={enrichmentErrors[selected.company.id]}
          position={position}
          total={visible.length}
          onNextCompany={() => visible[position + 1] && openCompany(visible[position + 1], drawerTab)}
          onPrevCompany={() => visible[position - 1] && openCompany(visible[position - 1], drawerTab)}
        />
      )}

      {thesisOpen && (
        <ThesisDrawer
          opened
          onClose={() => setThesisOpen(false)}
          thesis={thesis}
          onSaveThesis={saveThesis}
          companyCount={results.length}
        />
      )}

      {tourOpen && <DemoTourModal opened onClose={() => setTourOpen(false)} onAction={guideAction} />}

      {uploadOpen && (
        <CsvUploadModal
          opened
          onClose={() => setUploadOpen(false)}
          existing={companies}
          onImportCompanies={importCompanies}
        />
      )}

      {crmPushOpen && (
        <CrmPushModal
          opened
          onClose={() => setCrmPushOpen(false)}
          allCompanies={results}
          filteredCompanies={visible}
          selectedCompanies={selectedCompanies}
        />
      )}

      {shortcutsOpen && (
        <KeyboardShortcutsModal
          opened
          onClose={() => setShortcutsOpen(false)}
        />
      )}

      <Modal
        opened={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset demo workspace?"
        centered
      >
        <p className="text-sm text-stone-600 leading-relaxed">
          This restores the original demo criteria and companies, and removes imported leads
          from this device’s saved workspace. Export your research first if you want to keep it.
        </p>
        <div className="flex gap-3 justify-end mt-5">
          <Button variant="default" onClick={() => setResetOpen(false)}>
            Keep my workspace
          </Button>
          <Button
            disabled={!!enrichingId}
            onClick={() => {
              setDataset(demo.validList);
              setThesis(DEFAULT_DEMO_THESIS);
              setFilters(defaults);
              setSelectedId(null);
              setSelectedIds([]);
              setImportSummary(null);
              setEnrichmentErrors({});
              setResetOpen(false);
              notifications.show({
                title: 'Demo restored',
                message: 'The original companies and acquisition criteria are ready.',
                color: 'teal',
              });
            }}
          >
            Reset demo
          </Button>
        </div>
      </Modal>
    </div>
  );
}
