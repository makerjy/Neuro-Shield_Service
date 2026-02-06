import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface Stage {
  id: string;
  label: string;
  count: number;
  percentage: number;
  conversionRate: number | null;
  avgDuration: string | null;
}

interface PipelineFlowProps {
  stages: Stage[];
}

export function PipelineFlow({ stages }: PipelineFlowProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-6 text-xl font-semibold text-slate-900">모델 적용 단계별 플로우</h3>
      
      <div className="relative">
        <div className="flex items-center justify-between gap-3 overflow-x-auto pb-4">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="group relative min-w-[180px] cursor-pointer rounded-lg border-2 border-slate-300 bg-slate-50 p-4 transition-all hover:border-blue-500 hover:shadow-md"
                    >
                      <div className="mb-2 text-xs font-medium text-slate-600">
                        {stage.label}
                      </div>
                      <div className="mb-1 text-2xl font-bold text-slate-900">
                        {stage.count.toLocaleString()}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">전체 대비</span>
                        <span className="font-semibold text-blue-600">{stage.percentage}%</span>
                      </div>
                      {stage.conversionRate !== null && (
                        <div className="mt-2 border-t border-slate-200 pt-2 text-xs">
                          <span className="text-slate-500">전환율: </span>
                          <span className="font-semibold text-emerald-600">{stage.conversionRate}%</span>
                        </div>
                      )}
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <p className="font-semibold">{stage.label}</p>
                      <p className="text-xs">대상자: {stage.count.toLocaleString()}명</p>
                      <p className="text-xs">전체 대비: {stage.percentage}%</p>
                      {stage.conversionRate !== null && (
                        <p className="text-xs">전 단계 전환율: {stage.conversionRate}%</p>
                      )}
                      {stage.avgDuration && (
                        <p className="text-xs">평균 소요: {stage.avgDuration}</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {index < stages.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 0.05 }}
                  className="mx-2 flex-shrink-0"
                >
                  <ChevronRight className="size-6 text-slate-400" />
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
