import React from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = '데이터를 불러오는 중...' }: LoadingStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-4" />
        <p className="text-sm text-gray-500">{message}</p>
      </CardContent>
    </Card>
  );
}
