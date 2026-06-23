import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  delay?: number;
}

export default function MetricCard({ title, value, icon: Icon, trend, delay = 0 }: MetricCardProps) {
  return (
    <div 
      className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[var(--text-secondary)] text-sm font-medium">{title}</h3>
        <div className="p-2 bg-[var(--brand-primary)]/10 rounded-lg">
          <Icon className="w-5 h-5 text-[var(--brand-primary)]" />
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-[var(--text-primary)]">{value}</span>
        {trend && (
          <span className="text-xs text-[var(--text-secondary)] mt-1">{trend}</span>
        )}
      </div>
    </div>
  );
}
