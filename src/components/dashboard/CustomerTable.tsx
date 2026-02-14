'use client';

interface CustomerData {
  customer_name: string;
  sales: number;
  commission: number;
  count: number;
}

export default function CustomerTable({ data }: { data: CustomerData[] }) {
  const fmt = (n: number) =>
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Customers</h3>
      {data.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No data</p>
      ) : (
        <div className="overflow-auto max-h-72">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-gray-500 font-medium">Customer</th>
                <th className="text-right py-2 text-gray-500 font-medium">Sales</th>
                <th className="text-right py-2 text-gray-500 font-medium">Commission</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 text-gray-800 max-w-[200px] truncate" title={c.customer_name}>
                    {c.customer_name}
                  </td>
                  <td className="py-2 text-right text-gray-700">{fmt(c.sales)}</td>
                  <td className="py-2 text-right text-green-600 font-medium">{fmt(c.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
