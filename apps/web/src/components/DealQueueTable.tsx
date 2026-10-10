'use client';
import { useMemo, useRef, useEffect } from 'react';
import {
  Button,
  TextInput,
  Select,
  Menu,
  Badge,
  Tooltip,
  ActionIcon,
  Checkbox,
  Kbd,
} from '@mantine/core';
import {
  IconSearch,
  IconDownload,
  IconChevronDown,
  IconArrowRight,
  IconX,
  IconFilterOff,
  IconCloudUpload,
  IconFileText,
} from '@tabler/icons-react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { EnrichedCompanyResult, QueueFilters, BUCKET_LABELS } from '@deallens/shared';

interface Props {
  companies: EnrichedCompanyResult[];
  totalCount: number;
  industries: string[];
  filters: QueueFilters;
  onFilters: (next: Partial<QueueFilters>) => void;
  onResetFilters: () => void;
  onSelectCompany: (item: EnrichedCompanyResult) => void;
  onExport: (scope: 'filtered' | 'all' | 'selected') => void;
  onImport: () => void;
  onOpenCrmPush: () => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onExportDealBook?: (scope: 'selected' | 'filtered' | 'pursue_now') => void;
}

const MONOGRAM_PALETTES = [
  { bg: '#eef5ea', text: '#285836', border: '#d4e5ce' }, // Forest/Sage
  { bg: '#fbf5e7', text: '#745417', border: '#eedbb5' }, // Amber/Honey
  { bg: '#edf4f6', text: '#2c5565', border: '#cee2e8' }, // Ocean/Slate
  { bg: '#f5eff8', text: '#59386d', border: '#e1d0ea' }, // Plum/Mauve
  { bg: '#fbf0ed', text: '#773e2e', border: '#f0d1c8' }, // Terracotta
  { bg: '#eef3f7', text: '#2f4f6b', border: '#d3e2ee' }, // Steel Blue
];

function getMonogramStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % MONOGRAM_PALETTES.length;
  const p = MONOGRAM_PALETTES[index];
  return {
    backgroundColor: p.bg,
    color: p.text,
    borderColor: p.border,
  };
}

export function BucketBadge({ bucket }: { bucket: EnrichedCompanyResult['analysis']['actionBucket'] }) {
  return <span className={`bucket-badge bucket-${bucket.toLowerCase()}`}>{BUCKET_LABELS[bucket]}</span>;
}

export function Score({ value, label }: { value: number; label: string }) {
  return (
    <span className="score-value" aria-label={`${label}: ${value} out of 100`}>
      {value}
      <span className="text-xs text-stone-400 font-normal">/100</span>
    </span>
  );
}

export function DealQueueTable({
  companies,
  totalCount,
  industries,
  filters,
  onFilters,
  onResetFilters,
  onSelectCompany,
  onExport,
  onImport,
  onOpenCrmPush,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onClearSelection,
  onExportDealBook,
}: Props) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const active =
    filters.search !== '' ||
    filters.bucket !== 'ALL' ||
    filters.industry !== 'ALL' ||
    filters.minFit > 0 ||
    filters.minConfidence > 0 ||
    filters.evidence !== 'ALL' ||
    filters.source !== 'ALL';

  const visibleIds = useMemo(() => companies.map(c => c.company.id), [companies]);
  const allChecked = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const isIndeterminate = visibleIds.some(id => selectedIds.includes(id)) && !allChecked;

  const columns = useMemo<ColumnDef<EnrichedCompanyResult>[]>(() => [
    {
      id: 'select',
      header: () => (
        <Checkbox
          size="xs"
          aria-label="Select all visible companies"
          checked={allChecked}
          indeterminate={isIndeterminate}
          onChange={onToggleSelectAll}
        />
      ),
      cell: ({ row: { original: { company: c } } }) => (
        <Checkbox
          size="xs"
          aria-label={`Select ${c.name}`}
          checked={selectedIds.includes(c.id)}
          onChange={() => onToggleSelect(c.id)}
        />
      ),
    },
    {
      id: 'company',
      header: 'Company',
      cell: ({ row: { original: { company: c } } }) => (
        <div className="flex items-center gap-3 min-w-[230px]">
          <span
            className="company-monogram"
            style={getMonogramStyle(c.name)}
            aria-hidden="true"
          >
            {c.name.split(' ').slice(0, 2).map(w => w[0]).join('')}
          </span>
          <div>
            <button
              className="company-name"
              onClick={() => onSelectCompany(companies.find(x => x.company.id === c.id)!)}
            >
              {c.name}
            </button>
            <div className="text-xs text-stone-500 mt-1">
              {c.industry} <span aria-hidden="true">·</span>{' '}
              {c.dataSource === 'demo'
                ? 'Demo'
                : c.dataSource === 'live'
                ? 'Website researched'
                : 'Imported'}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'fit',
      header: 'Acquisition fit',
      cell: ({ row }) => <Score value={row.original.analysis.fitScore} label="Acquisition fit" />,
    },
    {
      id: 'owner',
      header: 'Owner signal',
      cell: ({ row }) => <Score value={row.original.analysis.ownerSignalScore} label="Owner signal" />,
    },
    {
      id: 'confidence',
      header: 'Confidence',
      cell: ({ row }) => (
        <div className="min-w-[85px]">
          <Score value={row.original.analysis.confidenceScore} label="Evidence confidence" />
          <div className="confidence-track" aria-hidden="true">
            <span style={{ width: `${row.original.analysis.confidenceScore}%` }} />
          </div>
        </div>
      ),
    },
    {
      id: 'evidence',
      header: 'Evidence & signals',
      cell: ({ row: { original: { company: c, analysis: a } } }) => (
        <div className="min-w-[175px] max-w-[220px]">
          <span className={`text-sm ${!a.evidence.length ? 'text-amber-800' : 'text-stone-700'}`}>
            {a.evidence.length
              ? `${a.evidence.length} ${c.dataSource === 'demo' ? 'sample' : 'source'} snippets`
              : 'Needs verification'}
          </span>
          <p className="text-xs text-stone-500 mt-1 mb-0">
            {['FAILED', 'TIMEOUT', 'BLOCKED_OR_UNAVAILABLE'].includes(c.crawlStatus)
              ? 'Website unavailable'
              : a.keySignals[0] || 'Ownership not verified'}
          </p>
        </div>
      ),
    },
    {
      id: 'action',
      header: 'Next step',
      cell: ({ row }) => (
        <div className="flex items-center justify-between gap-3">
          <BucketBadge bucket={row.original.analysis.actionBucket} />
          <Tooltip label={`Review ${row.original.company.name}`}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label={`Review ${row.original.company.name}`}
              onClick={() => onSelectCompany(row.original)}
            >
              <IconArrowRight size={18} />
            </ActionIcon>
          </Tooltip>
        </div>
      ),
    },
  ], [companies, onSelectCompany, selectedIds, allChecked, isIndeterminate, onToggleSelect, onToggleSelectAll]);

  const table = useReactTable({
    data: companies,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: row => row.company.id,
  });

  return (
    <section className="queue-panel" aria-labelledby="queue-title">
      <div className="p-5 sm:p-6 flex flex-wrap gap-4 items-center justify-between border-b border-stone-200/80">
        <div>
          <div className="flex items-center gap-3">
            <h2 id="queue-title" className="text-lg font-semibold tracking-tight m-0">
              Deal queue
            </h2>
            <Badge variant="light" color="gray" radius="sm">
              {companies.length}
            </Badge>
          </div>
          <p className="text-sm text-stone-500 mt-1 mb-0">Your next research decision starts here.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            leftSection={<IconCloudUpload size={16} className="text-orange-600" />}
            onClick={onOpenCrmPush}
          >
            Push to CRM
          </Button>
          <Menu position="bottom-end" shadow="md" width={250}>
            <Menu.Target>
              <Button
                variant="default"
                leftSection={<IconDownload size={16} />}
                rightSection={<IconChevronDown size={14} />}
              >
                Export CSV
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Includes evidence URLs & unknowns</Menu.Label>
              {selectedIds.length > 0 && (
                <Menu.Item onClick={() => onExport('selected')}>
                  Export selected leads ({selectedIds.length})
                </Menu.Item>
              )}
              <Menu.Item disabled={!companies.length} onClick={() => onExport('filtered')}>
                Export current view ({companies.length})
              </Menu.Item>
              <Menu.Item disabled={!totalCount} onClick={() => onExport('all')}>
                Export all companies ({totalCount})
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Executive Deal Books</Menu.Label>
              {selectedIds.length > 0 && onExportDealBook && (
                <Menu.Item
                  leftSection={<IconFileText size={15} />}
                  onClick={() => onExportDealBook('selected')}
                >
                  Compile Deal Book for selected ({selectedIds.length}) (.md)
                </Menu.Item>
              )}
              {onExportDealBook && (
                <Menu.Item
                  leftSection={<IconFileText size={15} />}
                  disabled={!companies.length}
                  onClick={() => onExportDealBook('filtered')}
                >
                  Compile Deal Book for current view ({companies.length}) (.md)
                </Menu.Item>
              )}
              {onExportDealBook && (
                <Menu.Item
                  leftSection={<IconFileText size={15} />}
                  onClick={() => onExportDealBook('pursue_now')}
                >
                  Compile Deal Book for Pursue Now leads (.md)
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-stone-900 text-stone-100 px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 animate-slide-up">
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="filled" color="teal" size="sm">
              {selectedIds.length}
            </Badge>
            <span className="font-medium text-stone-200">leads selected for bulk action</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="filled"
              color="teal"
              leftSection={<IconCloudUpload size={14} />}
              onClick={onOpenCrmPush}
            >
              Push Selected ({selectedIds.length}) to CRM
            </Button>
            {onExportDealBook && (
              <Button
                size="xs"
                variant="default"
                className="bg-stone-800 text-white border-stone-700 hover:bg-stone-700"
                leftSection={<IconFileText size={14} />}
                onClick={() => onExportDealBook('selected')}
              >
                Deal Book (.md)
              </Button>
            )}
            <Button
              size="xs"
              variant="default"
              className="bg-stone-800 text-white border-stone-700 hover:bg-stone-700"
              leftSection={<IconDownload size={14} />}
              onClick={() => onExport('selected')}
            >
              Export Selected
            </Button>
            <Button size="xs" variant="subtle" color="gray" onClick={onClearSelection}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      <div className="p-5 sm:px-6 space-y-4 border-b border-stone-200/80">
        <div className="flex flex-col sm:flex-row gap-3">
          <TextInput
            ref={searchInputRef}
            className="flex-1"
            aria-label="Search companies"
            placeholder="Search company, domain, location, or contact"
            leftSection={<IconSearch size={17} />}
            value={filters.search}
            onChange={e => onFilters({ search: e.currentTarget.value })}
            rightSection={
              filters.search ? (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label="Clear search"
                  onClick={() => onFilters({ search: '' })}
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : (
                <Tooltip label="Press / to focus search" withArrow>
                  <Kbd size="xs" className="hidden sm:inline-block cursor-default font-mono text-[10px]">
                    /
                  </Kbd>
                </Tooltip>
              )
            }
          />
          <Select
            aria-label="Sort companies"
            className="sm:w-52"
            allowDeselect={false}
            data={[
              { value: 'priority', label: 'Sort: research priority' },
              { value: 'fit', label: 'Sort: highest fit' },
              { value: 'confidence', label: 'Sort: highest confidence' },
              { value: 'name', label: 'Sort: company name' },
            ]}
            value={filters.sort}
            onChange={v => onFilters({ sort: v as QueueFilters['sort'] })}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Select
            label="Industry"
            size="xs"
            allowDeselect={false}
            value={filters.industry}
            onChange={v => onFilters({ industry: v || 'ALL' })}
            data={[{ value: 'ALL', label: 'All industries' }, ...industries.map(i => ({ value: i, label: i }))]}
          />
          <Select
            label="Minimum fit"
            size="xs"
            allowDeselect={false}
            value={String(filters.minFit)}
            onChange={v => onFilters({ minFit: Number(v) })}
            data={[
              { value: '0', label: 'Any score' },
              { value: '60', label: '60 / 100' },
              { value: '75', label: '75 / 100' },
              { value: '85', label: '85 / 100' },
            ]}
          />
          <Select
            label="Minimum confidence"
            size="xs"
            allowDeselect={false}
            value={String(filters.minConfidence)}
            onChange={v => onFilters({ minConfidence: Number(v) })}
            data={[
              { value: '0', label: 'Any score' },
              { value: '50', label: '50 / 100' },
              { value: '70', label: '70 / 100' },
            ]}
          />
          <Select
            label="Evidence"
            size="xs"
            allowDeselect={false}
            value={filters.evidence}
            onChange={v => onFilters({ evidence: v as QueueFilters['evidence'] })}
            data={[
              { value: 'ALL', label: 'All evidence states' },
              { value: 'HAS_EVIDENCE', label: 'Has source snippets' },
              { value: 'NEEDS_RESEARCH', label: 'Needs verification' },
              { value: 'FETCH_FAILED', label: 'Website unavailable' },
            ]}
          />
          <Select
            label="Data source"
            size="xs"
            allowDeselect={false}
            value={filters.source}
            onChange={v => onFilters({ source: v as QueueFilters['source'] })}
            data={[
              { value: 'ALL', label: 'All sources' },
              { value: 'demo', label: 'Demo fixtures' },
              { value: 'imported', label: 'Imported leads' },
              { value: 'live', label: 'Website researched' },
            ]}
          />
          <div className="flex items-end">
            <Button
              fullWidth
              variant="subtle"
              color="gray"
              size="xs"
              disabled={!active}
              onClick={onResetFilters}
              leftSection={<IconFilterOff size={15} />}
            >
              Clear filters
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3 bg-stone-50/60 text-xs text-stone-600">
        <span role="status">
          Showing {companies.length} of {totalCount} companies
          {filters.bucket !== 'ALL' ? ` · ${BUCKET_LABELS[filters.bucket]}` : ''}
        </span>
        <span className="hidden sm:inline">Scores out of 100 · Open a company for the evidence</span>
      </div>

      {companies.length ? (
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Company results table; scroll horizontally on smaller screens"
        >
          <table className="deal-table">
            <caption className="sr-only">
              Acquisition research queue. Scores, evidence, and next actions for {companies.length} companies.
            </caption>
            <thead>
              {table.getHeaderGroups().map(group => (
                <tr key={group.id}>
                  {group.headers.map(header => (
                    <th key={header.id} scope="col">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 px-6">
          <IconSearch size={30} className="text-stone-400 mx-auto" />
          <h3 className="text-lg font-semibold mt-4 mb-2">
            {totalCount ? 'No companies match these filters' : 'Your research queue starts here'}
          </h3>
          <p className="text-sm text-stone-500 mb-5">
            {totalCount
              ? 'Try a broader search or clear your filters to see the full queue.'
              : 'Import a CSV to compare companies against your acquisition criteria.'}
          </p>
          <Button variant="default" onClick={totalCount ? onResetFilters : onImport}>
            {totalCount ? 'Clear all filters' : 'Import companies'}
          </Button>
        </div>
      )}
      <div className="px-5 sm:px-6 py-4 border-t border-stone-200 text-xs text-stone-500">
        Owner signals guide research. They do not indicate willingness to sell.
      </div>
    </section>
  );
}
