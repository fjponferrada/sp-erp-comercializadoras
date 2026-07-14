import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface SectionCardProps {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  delay?: number;
  className?: string;
  action?: ReactNode;
}

export default function SectionCard({ title, icon: Icon, children, delay = 0, className = '', action }: SectionCardProps) {
  return (
    <div 
      className={`bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-sm ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="px-6 py-5 border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2 bg-[var(--brand-primary)]/10 rounded-lg">
              <Icon className="w-5 h-5 text-[var(--brand-primary)]" />
            </div>
          )}
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
        </div>
        {action && (
          <div>{action}</div>
        )}
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}
