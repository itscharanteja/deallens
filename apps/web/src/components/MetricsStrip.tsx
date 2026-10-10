'use client';
import { ActionBucket, BUCKET_LABELS } from '@deallens/shared';
import { IconArrowUpRight, IconSearch, IconClock, IconMinus, IconLayoutList } from '@tabler/icons-react';
interface Props { totalCount: number; bucketCounts: Record<ActionBucket, number>; selectedBucketFilter: ActionBucket | 'ALL'; onSelectBucketFilter: (bucket: ActionBucket | 'ALL') => void; }
const buckets = [
  { key: 'ALL', label: 'All companies', detail: 'Your complete workspace', icon: IconLayoutList, tone: 'neutral' },
  { key: 'PURSUE_NOW', label: BUCKET_LABELS.PURSUE_NOW, detail: 'Start with these companies', icon: IconArrowUpRight, tone: 'green' },
  { key: 'RESEARCH_OWNER', label: BUCKET_LABELS.RESEARCH_OWNER, detail: 'Clarify ownership first', icon: IconSearch, tone: 'amber' },
  { key: 'MONITOR', label: BUCKET_LABELS.MONITOR, detail: 'Keep on your research list', icon: IconClock, tone: 'neutral' },
  { key: 'SKIP', label: BUCKET_LABELS.SKIP, detail: 'Outside current criteria', icon: IconMinus, tone: 'neutral' },
] as const;
export function MetricsStrip({ totalCount, bucketCounts, selectedBucketFilter, onSelectBucketFilter }: Props) {
  return <nav aria-label="Filter companies by research priority" className="grid grid-cols-2 lg:grid-cols-5 gap-3 my-6">
    {buckets.map(({ key, label, detail, icon: Icon, tone }, i) => <button key={key} type="button" aria-pressed={selectedBucketFilter === key} onClick={() => onSelectBucketFilter(key)} className={`metric-card ${selectedBucketFilter === key ? 'metric-active' : ''} ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`}>
      <span className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{label}</span><Icon size={17} className={tone === 'green' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : 'text-stone-400'} /></span>
      <span className="block text-[30px] font-semibold tracking-tight tabular-nums mt-3 mb-1">{key === 'ALL' ? totalCount : bucketCounts[key]}</span>
      <span className="text-xs text-stone-500">{detail}</span>
    </button>)}
  </nav>;
}
