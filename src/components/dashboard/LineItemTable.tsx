'use client';

import { useState, useMemo } from 'react';

interface LineItem {
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

interface LineItemTableProps {
  entries: LineItem[];
}

type SortKey = 'customer_name' | 'invoice_number' | 'item_code' | 'sales_amount' | 'commission_amount';
type SortDirection = 'asc' | 'desc';

const fmt = (n: number | null) =>
  n != null ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

export default function LineItemTable({ entries }: LineItemTableProps) {
  const [filterText, setFilterText] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('sales_amount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    let result = entries;

    // Filter
    if (filterText) {
      const lower = filterText.toLowerCase();
      result = result.filter(
        (e) =>
          e.customer_name?.toLowerCase().includes(lower) ||
          e.invoice_number?.toLowerCase().includes(lower) ||
          e.item_code?.toLowerCase().includes(lower)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: any = a[sortKey];
      let bVal: any = b[sortKey];

      // Handle nulls
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;

      // Compare
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [entries, filterText, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null;
    return (
      <span className="ml-1 text-gray-400">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div className="p-6">
      {/* Filter input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Filter by customer, invoice, or item..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th
                onClick={() => handleSort('customer_name')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Customer <SortIcon columnKey="customer_name" />
              </th>
              <th
                onClick={() => handleSort('invoice_number')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Invoice # <SortIcon columnKey="invoice_number" />
              </th>
              <th
                onClick={() => handleSort('item_code')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Item/Product <SortIcon columnKey="item_code" />
              </th>
              <th
                onClick={() => handleSort('sales_amount')}
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Net Sales <SortIcon columnKey="sales_amount" />
              </th>
              <th
                onClick={() => handleSort('commission_amount')}
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Commission <SortIcon columnKey="commission_amount" />
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No entries found
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {entry.customer_name || '-'}
                    {entry.is_split && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Shared
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {entry.invoice_number || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {entry.item_code || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                    {fmt(entry.sales_amount)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-green-600">
                    {fmt(entry.commission_amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Results count */}
      <div className="mt-4 text-sm text-gray-500">
        Showing {filteredAndSorted.length} of {entries.length} entries
      </div>
    </div>
  );
}
