'use client';
import { useMemo, useState } from 'react';
import { Modal, Button, Textarea, FileInput, Alert, Select, Accordion, Badge } from '@mantine/core';
import { IconUpload, IconArrowRight, IconFileSpreadsheet, IconDownload } from '@tabler/icons-react';
import { Company, CsvImportResult, CsvMapping, CSV_FIELDS, CSV_MAX_BYTES, importCsv, readCsv, suggestCsvMapping } from '@deallens/shared';
import { downloadText } from '@/lib/download';
const SAMPLE = 'company_name,website,industry,location,revenue,employees,founded_year\nExample Technology,https://example.com,IT Services,"Austin, TX, United States",4500000,24,2007';
interface Props { opened: boolean; onClose: () => void; existing: Company[]; onImportCompanies: (result: CsvImportResult) => void; }
export function CsvUploadModal({ opened, onClose, existing, onImportCompanies }: Props) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | undefined>();
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const parsed = useMemo(() => { try { const rows = readCsv(text); return { headers: rows[0], mapping: suggestCsvMapping(rows[0]) }; } catch { return null; } }, [text]);
  const result = useMemo(() => { if (!preview) return null; try { return importCsv(text, existing, mapping); } catch { return null; } }, [text, existing, mapping, preview]);
  const loadFile = async (next: File | null) => {
    setFile(next); setPreview(false); setError(''); setMapping(undefined); setText('');
    if (!next) { setText(''); return; }
    if (next.size > CSV_MAX_BYTES) { setError('Choose a CSV smaller than 1 MB.'); return; }
    setReading(true);
    try { setText(await next.text()); } catch { setError('This file could not be read. Try another CSV or paste the data below.'); }
    finally { setReading(false); }
  };
  const review = () => { try { importCsv(text, existing, mapping); setPreview(true); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Check your CSV and try again.'); } };
  return <Modal closeButtonProps={{ 'aria-label': 'Close CSV import' }} opened={opened} onClose={onClose} title="Import companies" size="xl" padding="xl" closeOnClickOutside={!reading}>
    <div className="space-y-5"><div className="flex gap-2 text-xs font-medium text-stone-500"><span className={!preview ? 'text-emerald-800' : ''}>01 Upload & map</span><IconArrowRight size={14} /><span className={preview ? 'text-emerald-800' : ''}>02 Review & import</span></div>
      {!preview ? <><p className="text-sm text-stone-600 leading-relaxed">Bring your lead list into the queue. We’ll check each row, remove duplicates already in your workspace, and keep missing information marked as unknown.</p><FileInput label="Choose a CSV file" description="Up to 1 MB · 1,000 companies · Company name required" placeholder="Select your CSV" accept=".csv,text/csv" value={file} onChange={loadFile} leftSection={<IconFileSpreadsheet size={18} />} clearable disabled={reading} />
      <Textarea label="Or paste CSV data" placeholder="company_name,website,industry,location" rows={5} value={text} onChange={e => { setText(e.currentTarget.value); setMapping(undefined); setFile(null); setError(''); }} />
      <Button variant="subtle" color="gray" size="xs" leftSection={<IconDownload size={15} />} onClick={() => downloadText(SAMPLE, 'deallens-import-template.csv')}>Download CSV template</Button>
      {parsed && <Accordion variant="separated" defaultValue="mapping"><Accordion.Item value="mapping"><Accordion.Control>Check column mapping <Badge color="gray" variant="light" ml="sm">{parsed.headers.length} columns</Badge></Accordion.Control><Accordion.Panel><p className="text-xs text-stone-500 mt-0">Columns are matched automatically. Adjust any match below. Revenue is in USD; use full numbers such as 4500000.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{CSV_FIELDS.map(field => <Select key={field} label={`${field.replaceAll('_', ' ')}${field === 'company_name' ? ' *' : ''}`} placeholder="Not provided" clearable data={parsed.headers} value={(mapping ?? parsed.mapping)[field] || null} onChange={v => setMapping({ ...(mapping ?? parsed.mapping), [field]: v || undefined })} />)}</div></Accordion.Panel></Accordion.Item></Accordion>}
      </> : result && <><div className="grid grid-cols-3 gap-3">{[{ label: 'Ready to import', value: result.companies.length }, { label: 'Duplicates skipped', value: result.duplicates }, { label: 'Rows with issues', value: result.issues.length }].map(s => <div className="score-card" key={s.label}><div className="text-2xl font-semibold mb-1">{s.value}</div><div className="text-xs text-stone-500">{s.label}</div></div>)}</div><Alert color="gray">Imported company details are unverified. Evidence starts empty until you check a company’s website. Imports stay in this browser session; export your work before refreshing.</Alert>
      {result.issues.length > 0 && <Alert color="yellow" title="These rows will be skipped"><ul className="pl-4 my-0 text-sm">{result.issues.slice(0, 8).map(i => <li key={i.row}>Row {i.row}: {i.message}</li>)}</ul>{result.issues.length > 8 && <p>{result.issues.length - 8} more rows have issues.</p>}<Button mt="sm" size="xs" variant="white" color="gray" onClick={() => downloadText(['row,message', ...result.issues.map(i => `${i.row},"${i.message.replaceAll('"', '""')}"`)].join('\n'), 'import-issues.csv')}>Download all issues</Button></Alert>}
      <div className="overflow-x-auto"><table className="preview-table"><caption className="text-left text-sm font-medium pb-3">Preview · first {Math.min(5, result.companies.length)} of {result.companies.length} companies</caption><thead><tr><th>Company</th><th>Website</th><th>Industry</th></tr></thead><tbody>{result.companies.slice(0, 5).map(c => <tr key={c.id}><td>{c.name}</td><td>{c.normalizedDomain || 'Unknown'}</td><td>{c.industry}</td></tr>)}</tbody></table></div></>}
      {error && <Alert color="red" role="alert" title="Check your CSV">{error}</Alert>}
      <div className="flex justify-between gap-3 pt-4 border-t border-stone-200"><Button variant="default" onClick={preview ? () => setPreview(false) : onClose}>{preview ? 'Back to CSV' : 'Cancel'}</Button><Button loading={reading} disabled={preview ? !result?.companies.length : !text.trim()} leftSection={preview ? <IconUpload size={16} /> : undefined} rightSection={!preview ? <IconArrowRight size={16} /> : undefined} onClick={preview ? () => { if (result) onImportCompanies(result); } : review}>{preview ? `Import ${result?.companies.length || 0} companies` : 'Preview import'}</Button></div>
    </div>
  </Modal>;
}
