import React from 'react';
import { Badge } from './ui/badge';

export type RiskLevel = 'high' | 'medium' | 'low';
export type CaseStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';

interface StatusBadgeProps {
  type: 'risk' | 'status';
  value: RiskLevel | CaseStatus;
  className?: string;
}

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  if (type === 'risk') {
    const riskColors = {
      high: 'bg-[#ef4444] text-white hover:bg-[#dc2626]',
      medium: 'bg-[#f59e0b] text-white hover:bg-[#d97706]',
      low: 'bg-[#10b981] text-white hover:bg-[#059669]',
    };

    const riskLabels = {
      high: '고위험',
      medium: '중위험',
      low: '저위험',
    };

    return (
      <Badge className={`${riskColors[value as RiskLevel]} ${className || ''}`}>
        {riskLabels[value as RiskLevel]}
      </Badge>
    );
  }

  const statusColors = {
    pending: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    'in-progress': 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    completed: 'bg-green-100 text-green-700 hover:bg-green-200',
    cancelled: 'bg-red-100 text-red-700 hover:bg-red-200',
  };

  const statusLabels = {
    pending: '대기중',
    'in-progress': '진행중',
    completed: '완료',
    cancelled: '취소됨',
  };

  return (
    <Badge className={`${statusColors[value as CaseStatus]} ${className || ''}`}>
      {statusLabels[value as CaseStatus]}
    </Badge>
  );
}
