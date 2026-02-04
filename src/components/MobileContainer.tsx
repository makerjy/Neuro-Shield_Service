import React from 'react';

interface MobileContainerProps {
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function MobileContainer({ children, footer, className = '' }: MobileContainerProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className={`w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden flex flex-col ${className}`}>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="border-t bg-white sticky bottom-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
