'use client';

import { useState, useEffect, useCallback } from 'react';
import KPICard from '@/components/dashboard/KPICard';
import FactoryChart from '@/components/dashboard/FactoryChart';
import CustomerTable from '@/components/dashboard/CustomerTable';
import EntriesTable from '@/components/dashboard/EntriesTable';

interface DashboardData {
  total_sales: number;
  total_commission: number;
  entry_count: number;
  report_count: number;
  by_factory: { factory_name: string; sales: number; commission: number; count: number }[];
  by_customer: { customer_name: string; sales: number; commission: number; count: number }[];
  entries: {
    id: string;
    factory_name: string;
    customer_name: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    sales_amount: number | null;
    commission_amount: number | null;
    commission_rate: number | null;
    is_split: boolean;
  }[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = period ? `?period=${encodeURIComponent(period)}` : '';
      const res = await fetch(`/api/dashboard${params}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmt = (n: number) =>
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Period:</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
          >
            <option value="">All Time</option>
            <option value="OCT 2025">OCT 2025</option>
            <option value="SEP 2025">SEP 2025</option>
            <option value="NOV 2025">NOV 2025</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading dashboard...</div>
      ) : !data || data.entry_count === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No commission data yet.</p>
          <p className="text-gray-400 mt-2">
            Head to{' '}
            <a href="/upload" className="text-blue-600 hover:underline">
              Upload Reports
            </a>{' '}
            to get started.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Sales" value={fmt(data.total_sales)} color="blue" />
            <KPICard title="Total Commission" value={fmt(data.total_commission)} color="green" />
            <KPICard title="Entries" value={data.entry_count.toString()} color="purple" />
            <KPICard title="Reports" value={data.report_count.toString()} color="orange" />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FactoryChart data={data.by_factory} />
            <CustomerTable data={data.by_customer} />
          </div>

          {/* Recent entries */}
          <EntriesTable entries={data.entries} />
        </>
      )}
    </div>
  );
}
