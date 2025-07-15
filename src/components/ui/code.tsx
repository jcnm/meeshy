import React from 'react';
import { cn } from '@/lib/utils';

interface CodeProps extends React.HTMLAttributes<HTMLPreElement> {
  children: React.ReactNode;
}

export function Code({ children, className, ...props }: CodeProps) {
  return (
    <pre 
      className={cn(
        'p-4 rounded-lg bg-muted overflow-x-auto text-sm font-mono',
        className
      )} 
      {...props}
    >
      <code>{children}</code>
    </pre>
  );
}
