'use client';

import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Component to render markdown content with proper styling
 * Supports GitHub Flavored Markdown (GFM)
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  className
}) => {
  return (
    <div className={cn(
      'prose prose-sm dark:prose-invert max-w-none',
      'prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2',
      'prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
      'prose-p:my-2',
      'prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline',
      'prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm',
      'prose-code:before:content-none prose-code:after:content-none',
      'prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:p-3 prose-pre:rounded-md prose-pre:overflow-x-auto',
      'prose-ul:my-2 prose-ol:my-2 prose-li:my-1',
      'prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600 prose-blockquote:pl-4 prose-blockquote:italic',
      'prose-table:border-collapse prose-table:w-full',
      'prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600 prose-th:bg-gray-100 dark:prose-th:bg-gray-800 prose-th:px-3 prose-th:py-2',
      'prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600 prose-td:px-3 prose-td:py-2',
      'prose-img:rounded-lg prose-img:shadow-md',
      'prose-hr:border-gray-300 dark:prose-hr:border-gray-600',
      className
    )}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
};
