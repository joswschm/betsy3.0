'use client';

import { useState, useRef, useEffect } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTH_ABBREVS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MONTH_LABELS  = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseMonthKey(period: string | null): string {
  if (!period) return 'Unknown';
  const parts = period.trim().toLowerCase().split(/\s+/);
  if (parts.length === 2) {
    const mIdx = MONTH_ABBREVS.findIndex(m => m.toLowerCase() === parts[0]);
    if (mIdx !== -1) return `${parts[1]}-${String(mIdx + 1).padStart(2, '0')}`;
  }
  return period;
}

function formatMonthKey(key: string): string {
  if (key === 'Unknown') return 'Unknown Period';
  const [year, month] = key.split('-');
  return `${MONTH_LABELS[parseInt(month) - 1]} ${year}`;
}

function parsePeriodToMonthYear(period: string | null): { month: string; year: string } {
  const now = new Date();
  if (!period) return { month: MONTH_ABBREVS[now.getMonth()], year: String(now.getFullYear()) };
  const parts = period.trim().toUpperCase().split(/\s+/);
  if (parts.length === 2 && MONTH_ABBREVS.includes(parts[0])) {
    return { month: parts[0], year: parts[1] };
  }
  return { month: MONTH_ABBREVS[now.getMonth()], year: String(now.getFullYear()) };
}

// ── Factory badge colours ─────────────────────────────────────────────────────
const FACTORY_COLOR_MAP: Record<string, string> = {
  hat:      'bg-blue-100 text-blue-700 border-blue-200',
  mg:       'bg-emerald-100 text-emerald-700 border-emerald-200',
  marble:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  darran:   'bg-violet-100 text-violet-700 border-violet-200',
  symphony: 'bg-orange-100 text-orange-700 border-orange-200',
  carnegie: 'bg-rose-100 text-rose-700 border-rose-200',
  wit:      'bg-cyan-100 text-cyan-700 border-cyan-200',
  tracy:    'bg-pink-100 text-pink-700 border-pink-200',
  bennett:  'bg-pink-100 text-pink-700 border-pink-200',
};

function factoryBadgeColor(name: string): string {
  const lower = (name || '').toLowerCase();
  for (const [k, v] of Object.entries(FACTORY_COLOR_MAP)) {
    if (lower.includes(k)) return v;
  }
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

// ── Completeness tracking ─────────────────────────────────────────────────────
const TRACKED_FACTORIES = [
  { key: 'hat',      label: 'HAT' },
  { key: 'mg',       label: 'MG' },
  { key: 'darran',   label: 'DARRAN' },
  { key: 'symphony', label: 'SYMPHONY' },
  { key: 'tracy',    label: 'Tracy Bennett' },
];

function getFactoryKey(name: string): string {
  const lower = (name || '').toLowerCase();
  for (const f of TRACKED_FACTORIES) {
    if (lower.includes(f.key)) return f.key;
  }
  return lower.split(/\s+/)[0]; // fallback: first word
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Report {
  id: string;
  factory_name: string;
  file_name: string;
  report_period: string | null;
  created_at?: string;
  entry_count: number;
}

interface UploadResult {
  report_id: string;
  factory: string;
  extracted_count: number;
  message: string;
  entries: {
    customer_name: string | null;
    sales_amount: number | null;
    commission_amount: number | null;
    invoice_number: string | null;
    invoice_date: string | null;
  }[];
}

const FACTORIES = [
  { key: '',        label: 'Auto-detect from filename' },
  { key: 'hat',     label: 'HAT Commissions' },
  { key: 'mg',      label: 'MG (Marble Granite)' },
  { key: 'darran',  label: 'DARRAN' },
  { key: 'symphony',label: 'SYMPHONY' },
  { key: 'tracy',   label: 'Tracy Bennett (11)' },
];

// ── MonthlyReportList ─────────────────────────────────────────────────────────
interface MonthlyReportListProps {
  reports: Report[];
  deleting: boolean;
  onDelete: (r: Report) => void;
  onReclassify: (r: Report, newPeriod: string) => Promise<void>;
}

function MonthlyReportList({ reports, deleting, onDelete, onReclassify }: MonthlyReportListProps) {
  // Group by month
  const grouped: Record<string, Report[]> = {};
  for (const r of reports) {
    const key = parseMonthKey(r.report_period);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    return b.localeCompare(a);
  });

  const [openMonth, setOpenMonth] = useState<string>(sortedKeys[0] || '');

  // Inline edit state
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editMonth, setEditMonth]   = useState('');
  const [editYear, setEditYear]     = useState('');
  const [saving, setSaving]         = useState(false);

  function startEdit(report: Report) {
    const { month, year } = parsePeriodToMonthYear(report.report_period);
    setEditingId(report.id);
    setEditMonth(month);
    setEditYear(year);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditMonth('');
    setEditYear('');
  }

  async function saveEdit(report: Report) {
    if (!editMonth || !editYear || editYear.length !== 4) return;
    setSaving(true);
    try {
      await onReclassify(report, `${editMonth} ${editYear}`);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  // Keep activeMonth valid after data refreshes
  const activeMonth = openMonth && grouped[openMonth] ? openMonth : (sortedKeys[0] || '');

  // ── Completeness: which tracked factories are present in the active month ──
  const factoryKeysInMonth = new Set(
    (grouped[activeMonth] || []).map(r => getFactoryKey(r.factory_name))
  );
  const missingFactories = TRACKED_FACTORIES.filter(f => !factoryKeysInMonth.has(f.key));

  // ── Duplicate detection: factory appears more than once in the same month ──
  const factoryKeyCount: Record<string, number> = {};
  for (const r of (grouped[activeMonth] || [])) {
    const k = getFactoryKey(r.factory_name);
    factoryKeyCount[k] = (factoryKeyCount[k] || 0) + 1;
  }
  const isDuplicate = (r: Report) => factoryKeyCount[getFactoryKey(r.factory_name)] > 1;

  if (sortedKeys.length === 0) return null;

  return (
    <div className="space-y-3">

      {/* ── Month tab pills ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {sortedKeys.map((key) => (
          <button
            key={key}
            onClick={() => setOpenMonth(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeMonth === key
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {formatMonthKey(key)}
            <span className={`ml-2 text-xs ${activeMonth === key ? 'text-gray-300' : 'text-gray-400'}`}>
              {grouped[key].length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Report rows for selected month ───────────────────────────────── */}
      {activeMonth && grouped[activeMonth] && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

          {/* Panel header */}
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-500">
              {formatMonthKey(activeMonth)} &middot; {grouped[activeMonth].length} report{grouped[activeMonth].length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* ── Completeness status bar ───────────────────────────────────── */}
          <div className="px-5 py-2.5 bg-white border-b border-gray-100 flex items-center gap-4 flex-wrap">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide shrink-0">Factories</span>
            {TRACKED_FACTORIES.map(f => {
              const present = factoryKeysInMonth.has(f.key);
              return (
                <span key={f.key} className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  present ? 'text-green-600' : 'text-gray-300'
                }`}>
                  <span className={`w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[9px] font-bold ${
                    present ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {present ? '✓' : '○'}
                  </span>
                  {f.label}
                </span>
              );
            })}
            {missingFactories.length > 0 && (
              <span className="ml-auto text-xs font-medium text-amber-500 shrink-0">
                Missing: {missingFactories.map(f => f.label).join(', ')}
              </span>
            )}
          </div>

          <div className="divide-y divide-gray-100">
            {grouped[activeMonth].map((report) => (
              <div key={report.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">

                {/* ── Normal row ─────────────────────────────────────────── */}
                {editingId !== report.id ? (
                  <div className="flex items-start gap-3">

                    {/* Left: name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-gray-900 leading-snug break-words">
                        {report.file_name
                          ? report.file_name
                          : <span className="italic text-gray-400 font-normal">Unnamed report</span>
                        }
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${factoryBadgeColor(report.factory_name)}`}>
                          {report.factory_name || 'Unknown factory'}
                        </span>
                        {report.entry_count === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
                            ⚠ 0 entries — extraction may have failed
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">{report.entry_count.toLocaleString()} entries</span>
                        )}
                        {isDuplicate(report) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-500 border border-red-200">
                            ⚠ Duplicate — same factory uploaded twice this month
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: action icons */}
                    <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                      <button
                        onClick={() => startEdit(report)}
                        disabled={deleting}
                        title="Reassign to a different month"
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={() => onDelete(report)}
                        disabled={deleting}
                        title="Delete this report"
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                ) : (

                  /* ── Edit / reclassify row ────────────────────────────── */
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-3 break-words">
                      {report.file_name}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-500 font-medium whitespace-nowrap">Move to:</span>

                      {/* Month selector */}
                      <select
                        value={editMonth}
                        onChange={(e) => setEditMonth(e.target.value)}
                        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {MONTH_ABBREVS.map((m, i) => (
                          <option key={m} value={m}>{MONTH_LABELS[i]}</option>
                        ))}
                      </select>

                      {/* Year input */}
                      <input
                        type="text"
                        value={editYear}
                        onChange={(e) => setEditYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="YYYY"
                        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm w-20 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />

                      <button
                        onClick={() => saveEdit(report)}
                        disabled={saving || editYear.length !== 4}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── UploadPage ────────────────────────────────────────────────────────────────
export default function UploadPage() {
  const [factory, setFactory]       = useState('');
  const [uploading, setUploading]   = useState(false);
  const [result, setResult]         = useState<UploadResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [dragOver, setDragOver]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [reports, setReports]           = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [deleteConfirm, setDeleteConfirm]   = useState<{ isOpen: boolean; report: Report | null }>({
    isOpen: false, report: null,
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchReports(); }, []);

  async function fetchReports() {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoadingReports(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setResult(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (factory) formData.append('factory', factory);
      const res  = await fetch('/api/upload', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) setError(json.error || 'Upload failed');
      else { setResult(json); fetchReports(); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(report: Report) {
    setDeleting(true);
    try {
      const res  = await fetch(`/api/reports/${report.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) alert(json.error || 'Failed to delete report');
      else fetchReports();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete report');
    } finally {
      setDeleting(false);
      setDeleteConfirm({ isOpen: false, report: null });
    }
  }

  async function handleReclassify(report: Report, newPeriod: string) {
    try {
      const res  = await fetch(`/api/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_period: newPeriod }),
      });
      const json = await res.json();
      if (!res.ok) alert(json.error || 'Failed to update report period');
      else await fetchReports();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  const fmt = (n: number | null) =>
    n != null ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Upload Commission Report</h1>

      {/* Factory selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Factory</label>
        <select
          value={factory}
          onChange={(e) => setFactory(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
        >
          {FACTORIES.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        {uploading ? (
          <div className="text-blue-600">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mb-3" />
            <p className="font-medium">Processing file...</p>
            <p className="text-sm text-gray-500 mt-1">Detecting highlighted rows</p>
          </div>
        ) : (
          <>
            <p className="text-lg font-medium text-gray-700">Drop your report here</p>
            <p className="text-sm text-gray-500 mt-2">or click to browse — .xlsx or .pdf files</p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      )}

      {/* Upload result preview */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-green-500 text-xl">&#10003;</span>
            <div>
              <p className="font-semibold text-gray-900">{result.message}</p>
              <p className="text-sm text-gray-500">Factory: {result.factory}</p>
            </div>
          </div>
          {result.entries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-gray-500">Customer</th>
                    <th className="text-left py-2 text-gray-500">Invoice</th>
                    <th className="text-left py-2 text-gray-500">Date</th>
                    <th className="text-right py-2 text-gray-500">Sales</th>
                    <th className="text-right py-2 text-gray-500">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {result.entries.map((e, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 text-gray-800">{e.customer_name || '-'}</td>
                      <td className="py-2 text-gray-600 font-mono text-xs">{e.invoice_number || '-'}</td>
                      <td className="py-2 text-gray-600">{e.invoice_date || '-'}</td>
                      <td className="py-2 text-right text-gray-800">{fmt(e.sales_amount)}</td>
                      <td className="py-2 text-right text-green-600 font-medium">{fmt(e.commission_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Uploaded Reports — Organised by Month ──────────────────────────── */}
      <div className="mt-12 space-y-5">
        <h2 className="text-xl font-semibold text-gray-900">Uploaded Reports</h2>
        {loadingReports ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading reports…</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No reports uploaded yet.</div>
        ) : (
          <MonthlyReportList
            reports={reports}
            deleting={deleting}
            onDelete={(report) => setDeleteConfirm({ isOpen: true, report })}
            onReclassify={handleReclassify}
          />
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Report?"
        message={`Are you sure you want to delete "${deleteConfirm.report?.file_name}"? This will permanently remove the report and all ${deleteConfirm.report?.entry_count} associated commission entries. This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        dangerous
        onConfirm={() => deleteConfirm.report && handleDelete(deleteConfirm.report)}
        onCancel={() => setDeleteConfirm({ isOpen: false, report: null })}
      />
    </div>
  );
}
