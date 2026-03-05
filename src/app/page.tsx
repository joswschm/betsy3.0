'use client';

import { useState, useEffect } from 'react';
import AnimatedKPI from '@/components/dashboard/AnimatedKPI';
import MonthTabs from '@/components/dashboard/MonthTabs';
import FactorySection from '@/components/dashboard/FactorySection';

// ── Motivational quotes (rotates daily) ──────────────────────────────────────
const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { text: "Great things never come from comfort zones.", author: "Unknown" },
  { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
  { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller" },
  { text: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "If you are not willing to risk the usual, you will have to settle for the ordinary.", author: "Jim Rohn" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "It's not whether you get knocked down, it's whether you get up.", author: "Vince Lombardi" },
  { text: "People who succeed have momentum. The more they succeed, the more they want to succeed.", author: "Tony Robbins" },
  { text: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "Whether you think you can or think you can't, you're right.", author: "Henry Ford" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
  { text: "I never dreamed about success. I worked for it.", author: "Estée Lauder" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "The road to success and the road to failure are almost exactly the same.", author: "Colin R. Davis" },
  { text: "An entrepreneur is someone who jumps off a cliff and builds a plane on the way down.", author: "Reid Hoffman" },
  { text: "Just when the caterpillar thought the world was ending, it became a butterfly.", author: "Unknown" },
  { text: "Winning isn't everything, but wanting to win is.", author: "Vince Lombardi" },
  { text: "Dream it. Wish it. Do it.", author: "Unknown" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
  { text: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" },
  { text: "In order to succeed, your desire for success should be greater than your fear of failure.", author: "Bill Cosby" },
];

function getDailyQuote() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(month) - 1]} ${year}`;
}

const fmt = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Types ─────────────────────────────────────────────────────────────────────
interface MonthlyDashboardData {
  all_time: { total_sales: number; total_commission: number };
  available_months: string[];
  monthly_data: {
    [monthKey: string]: {
      month_sales: number;
      month_commission: number;
      factories: Array<{
        factory_name: string;
        sales: number;
        commission: number;
        entry_count: number;
        entries: any[];
      }>;
    };
  };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState<MonthlyDashboardData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const quote = getDailyQuote();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dashboard/monthly');
        const json = await res.json();
        setData(json);
        if (json.available_months?.length > 0) {
          setSelectedMonth(json.available_months[0]);
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const monthData = selectedMonth && data?.monthly_data ? data.monthly_data[selectedMonth] : null;

  return (
    <div className="space-y-8 pb-16">

      {/* ── Daily Quote ─────────────────────────────────────────────────────── */}
      <div className="text-center pt-2 pb-1">
        <p className="text-xl font-bold italic text-gray-600">
          &ldquo;{quote.text}&rdquo;
        </p>
        <p className="text-sm text-gray-400 mt-2 tracking-wide">— {quote.author}</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading dashboard…</div>
      ) : !data || data.available_months.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">No commission data yet.</p>
          <p className="text-gray-400 mt-2 text-sm">
            Head to{' '}
            <a href="/upload" className="text-blue-600 hover:underline font-medium">Upload Reports</a>
            {' '}to get started.
          </p>
        </div>
      ) : (
        <>
          {/* ── Animated All-Time KPIs ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AnimatedKPI
              title="All-Time Total Sales"
              rawValue={data.all_time.total_sales}
              color="blue"
            />
            <AnimatedKPI
              title="All-Time Total Commission"
              rawValue={data.all_time.total_commission}
              color="green"
            />
          </div>

          {/* ── Unified Monthly Panel ────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Panel header + month tabs */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Breakdown</h2>
              <MonthTabs
                months={data.available_months}
                selectedMonth={selectedMonth || ''}
                onSelectMonth={setSelectedMonth}
              />
            </div>

            {monthData ? (
              <>
                {/* Month KPIs row */}
                <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
                  <div className="px-6 py-5">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">
                      {selectedMonth ? formatMonthLabel(selectedMonth) : ''} Sales
                    </p>
                    <p className="text-3xl font-bold text-gray-900 tabular-nums">
                      {fmt(monthData.month_sales)}
                    </p>
                  </div>
                  <div className="px-6 py-5">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">
                      {selectedMonth ? formatMonthLabel(selectedMonth) : ''} Commission
                    </p>
                    <p className="text-3xl font-bold text-green-600 tabular-nums">
                      {fmt(monthData.month_commission)}
                    </p>
                  </div>
                </div>

                {/* Factory sections — nested inside panel */}
                <div className="divide-y divide-gray-100">
                  {monthData.factories.length === 0 ? (
                    <p className="text-center py-10 text-gray-400 text-sm">No factory data for this month.</p>
                  ) : (
                    monthData.factories.map((factory) => (
                      <FactorySection
                        key={factory.factory_name}
                        factoryName={factory.factory_name}
                        sales={factory.sales}
                        commission={factory.commission}
                        entryCount={factory.entry_count}
                        entries={factory.entries}
                      />
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">
                Select a month above to see the breakdown.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
