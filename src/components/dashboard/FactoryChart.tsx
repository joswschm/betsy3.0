'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface FactoryData {
  factory_name: string;
  sales: number;
  commission: number;
  count: number;
}

export default function FactoryChart({ data }: { data: FactoryData[] }) {
  const fmt = (n: number) => '$' + (n / 1000).toFixed(1) + 'k';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Sales & Commission by Factory</h3>
      {data.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No data</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="factory_name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number) =>
                '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2 })
              }
            />
            <Legend />
            <Bar dataKey="sales" name="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="commission" name="Commission" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
