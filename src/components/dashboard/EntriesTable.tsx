'use client';

interface Entry {
  id: string;
  factory_name: string;
  customer_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  sales_amount: number | null;
  commission_amount: number | null;
  commission_rate: number | null;
  is_split: boolean;
}

export default function EntriesTable({ entries }: { entries: Entry[] }) {
  const fmt = (n: number | null) =>
    n != null
      ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '-';

  const pct = (n: number | null) =>
    n != null ? (n * 100).toFixed(1) + '%' : '-';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Entries</h3>
      {entries.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No entries</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 text-gray-500 font-medium">Factory</th>
                <th className="text-left py-2 px-2 text-gray-500 font-medium">Customer</th>
                <th className="text-left py-2 px-2 text-gray-500 font-medium">Invoice</th>
                <th className="text-left py-2 px-2 text-gray-500 font-medium">Date</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Sales</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Rate</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Commission</th>
                <th className="text-center py-2 px-2 text-gray-500 font-medium">Split</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-2">
                    <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                      {e.factory_name}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-gray-800 max-w-[180px] truncate" title={e.customer_name || ''}>
                    {e.customer_name || '-'}
                  </td>
                  <td className="py-2 px-2 text-gray-600 font-mono text-xs">{e.invoice_number || '-'}</td>
                  <td className="py-2 px-2 text-gray-600">{e.invoice_date || '-'}</td>
                  <td className="py-2 px-2 text-right text-gray-800">{fmt(e.sales_amount)}</td>
                  <td className="py-2 px-2 text-right text-gray-600">{pct(e.commission_rate)}</td>
                  <td className="py-2 px-2 text-right text-green-600 font-medium">{fmt(e.commission_amount)}</td>
                  <td className="py-2 px-2 text-center">
                    {e.is_split && <span className="text-xs text-orange-500 font-medium">Split</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
