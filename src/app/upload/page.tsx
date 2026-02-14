'use client';

import { useState, useRef } from 'react';

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
  { key: '', label: 'Auto-detect from filename' },
  { key: 'hat', label: 'HAT Commissions' },
  { key: 'mg', label: 'MG (Marble Granite)' },
  { key: 'darran', label: 'DARRAN' },
  { key: 'symphony', label: 'SYMPHONY' },
];

export default function UploadPage() {
  const [factory, setFactory] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (factory) formData.append('factory', factory);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Upload failed');
      } else {
        setResult(json);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
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
    </div>
  );
}
