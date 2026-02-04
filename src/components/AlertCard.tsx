import React from 'react';
import { Card, CardContent } from './ui/card';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertCardProps {
  type?: AlertType;
  title?: string;
  message: string;
  className?: string;
}

export function AlertCard({ type = 'info', title, message, className = '' }: AlertCardProps) {
  const typeStyles = {
    info: {
      bg: 'bg-blue-50 border-blue-200',
      icon: <Info className="w-5 h-5 text-blue-600" />,
      titleColor: 'text-blue-900',
      textColor: 'text-blue-700',
    },
    success: {
      bg: 'bg-green-50 border-green-200',
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      titleColor: 'text-green-900',
      textColor: 'text-green-700',
    },
    warning: {
      bg: 'bg-yellow-50 border-yellow-200',
      icon: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
      titleColor: 'text-yellow-900',
      textColor: 'text-yellow-700',
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      icon: <AlertCircle className="w-5 h-5 text-red-600" />,
      titleColor: 'text-red-900',
      textColor: 'text-red-700',
    },
  };

  const style = typeStyles[type];

  return (
    <Card className={`${style.bg} border ${className}`}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
          <div className="flex-1">
            {title && <h4 className={`mb-1 ${style.titleColor}`}>{title}</h4>}
            <p className={`text-sm ${style.textColor}`}>{message}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
