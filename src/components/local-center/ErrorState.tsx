import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ 
  title = '오류가 발생했습니다',
  message, 
  onRetry,
  retryLabel = '다시 시도'
}: ErrorStateProps) {
  return (
    <Card className="border-red-200">
      <CardContent className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription className="mt-2">
            {message}
          </AlertDescription>
          {onRetry && (
            <div className="mt-4">
              <Button onClick={onRetry} variant="outline" size="sm">
                {retryLabel}
              </Button>
            </div>
          )}
        </Alert>
      </CardContent>
    </Card>
  );
}
