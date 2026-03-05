'use client';

import { useState } from 'react';
import LineItemTable from './LineItemTable';

interface FactoryEntry {
  id: string;
  customer_name: string | null;
  invoice_number: string | null;
  item_code: string | null;
  sales_amount: number | null;
  commission_amount: number | null;
  invoice_date: string | null;
  description: string | null;
  is_split: boolean;
  split_with: string | null;
  region: string | null;
}

interface FactorySectionProps {
  factoryName: string;
  sales: number;
  commission: number;
  entryCount: number;
  entries: FactoryEntry[];
}

const fmt = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FactorySection({
  factoryName,
  sales,
  commission,
  entryCount,
  entries
}: FactorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all">
      {/* Factory header - clickable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 text-lg">{factoryName}</h3>
            <p className="text-sm text-gray-500">{entryCount} entries</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          {/* KPIs */}
          <div className="text-right">
            <p className="text-sm text-gray-500">Sales</p>
            <p className="text-lg font-semibold text-gray-900">{fmt(sales)}</p>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-500">Commission</p>
            <p className="text-lg font-semibold text-green-600">{fmt(commission)}</p>
          </div>

          {/* Expand/collapse icon */}
          <div className="ml-4">
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Expandable line items */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50">
          <LineItemTable entries={entries} />
        </div>
      )}
    </div>
  );
}
