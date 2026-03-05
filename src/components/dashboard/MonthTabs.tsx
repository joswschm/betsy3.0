'use client';

import { useState } from 'react';

interface MonthTabsProps {
  months: string[]; // ["2025-11", "2025-10", ...]
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

const formatMonth = (monthKey: string): string => {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export default function MonthTabs({ months, selectedMonth, onSelectMonth }: MonthTabsProps) {
  const [visibleStart, setVisibleStart] = useState(0);
  const visibleCount = 7;

  const visibleMonths = months.slice(visibleStart, visibleStart + visibleCount);
  const canScrollLeft = visibleStart > 0;
  const canScrollRight = visibleStart + visibleCount < months.length;

  const scrollLeft = () => {
    setVisibleStart(Math.max(0, visibleStart - visibleCount));
  };

  const scrollRight = () => {
    setVisibleStart(Math.min(months.length - visibleCount, visibleStart + visibleCount));
  };

  return (
    <div className="flex items-center gap-2 overflow-hidden">
      {/* Left scroll button */}
      {canScrollLeft && (
        <button
          onClick={scrollLeft}
          className="flex-shrink-0 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Show earlier months"
        >
          •••
        </button>
      )}

      {/* Month tabs */}
      <div className="flex gap-2 flex-1 overflow-hidden">
        {visibleMonths.map((month) => (
          <button
            key={month}
            onClick={() => onSelectMonth(month)}
            className={`
              flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm transition-all
              ${
                month === selectedMonth
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }
            `}
          >
            {formatMonth(month)}
          </button>
        ))}
      </div>

      {/* Right scroll button */}
      {canScrollRight && (
        <button
          onClick={scrollRight}
          className="flex-shrink-0 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Show later months"
        >
          •••
        </button>
      )}
    </div>
  );
}
