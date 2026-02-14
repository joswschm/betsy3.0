'use client';

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
};

interface KPICardProps {
  title: string;
  value: string;
  color?: string;
}

export default function KPICard({ title, value, color = 'blue' }: KPICardProps) {
  const colors = colorMap[color] || colorMap.blue;
  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-5`}>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${colors.text}`}>{value}</p>
    </div>
  );
}
