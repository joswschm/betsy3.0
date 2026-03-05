'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedKPIProps {
  title: string;
  rawValue: number;       // The actual number to animate to
  color?: 'blue' | 'green';
  duration?: number;      // ms, default 1800
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function AnimatedKPI({
  title,
  rawValue,
  color = 'blue',
  duration = 1800,
}: AnimatedKPIProps) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!rawValue) return;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setDisplay(eased * rawValue);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(rawValue);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [rawValue, duration]);

  const formatted =
    '$' + display.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isGreen = color === 'green';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Icon dot */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isGreen ? 'bg-green-50' : 'bg-blue-50'}`}>
        <div className={`w-4 h-4 rounded-full ${isGreen ? 'bg-green-400' : 'bg-blue-400'}`} />
      </div>

      {/* Label */}
      <p className="text-sm font-medium text-gray-400 uppercase tracking-widest">{title}</p>

      {/* Animated number */}
      <p
        className={`text-5xl font-bold tabular-nums tracking-tight leading-none ${
          isGreen ? 'text-green-600' : 'text-gray-900'
        }`}
      >
        {formatted}
      </p>
    </div>
  );
}
