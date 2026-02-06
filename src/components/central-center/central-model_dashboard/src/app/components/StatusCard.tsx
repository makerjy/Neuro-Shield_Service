import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface StatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  status?: 'normal' | 'caution' | 'abnormal' | 'neutral';
  percentage?: number;
}

export function StatusCard({ title, value, subtitle, icon: Icon, status = 'neutral', percentage }: StatusCardProps) {
  const statusColors = {
    normal: 'border-emerald-500/30 bg-emerald-500/5',
    caution: 'border-amber-500/30 bg-amber-500/5',
    abnormal: 'border-red-500/30 bg-red-500/5',
    neutral: 'border-slate-300/30 bg-slate-50/50'
  };

  const iconColors = {
    normal: 'text-emerald-600',
    caution: 'text-amber-600',
    abnormal: 'text-red-600',
    neutral: 'text-slate-600'
  };

  const textColors = {
    normal: 'text-emerald-700',
    caution: 'text-amber-700',
    abnormal: 'text-red-700',
    neutral: 'text-slate-700'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-xl border-2 p-6 shadow-sm transition-all hover:shadow-md ${statusColors[status]}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Icon className={`size-5 ${iconColors[status]}`} />
            <p className="text-sm text-slate-600">{title}</p>
          </div>
          <p className="text-3xl font-semibold text-slate-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          )}
          {percentage !== undefined && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className={textColors[status]}>상태</span>
                <span className={textColors[status]}>{percentage}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full ${status === 'normal' ? 'bg-emerald-500' : status === 'caution' ? 'bg-amber-500' : status === 'abnormal' ? 'bg-red-500' : 'bg-slate-400'}`}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
