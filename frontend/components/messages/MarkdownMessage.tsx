'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

/**
 * Component to render message content with GitHub Flavored Markdown support
 * Features:
 * - Full GFM support (tables, task lists, strikethrough, etc.)
 * - Syntax highlighting for code blocks
 * - Auto-detects language from code fences
 * - Dark mode support
 * - Inline code highlighting
 */
export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({
  content,
  className = ''
}) => {
  const { theme, resolvedTheme } = useTheme();
  const isDark = theme === 'dark' || resolvedTheme === 'dark';

  return (
    <div className={`markdown-message ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          // Custom code block rendering with syntax highlighting
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            return !inline && language ? (
              <SyntaxHighlighter
                style={isDark ? vscDarkPlus : vs}
                language={language}
                PreTag="div"
                className="rounded-md my-2 text-sm"
                showLineNumbers={true}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code
                className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          // Custom link rendering
          a({ node, children, href, ...props }: any) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
                {...props}
              >
                {children}
              </a>
            );
          },
          // Custom table rendering
          table({ node, children, ...props }: any) {
            return (
              <div className="overflow-x-auto my-4">
                <table
                  className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700"
                  {...props}
                >
                  {children}
                </table>
              </div>
            );
          },
          thead({ node, children, ...props }: any) {
            return (
              <thead className="bg-gray-50 dark:bg-gray-800" {...props}>
                {children}
              </thead>
            );
          },
          th({ node, children, ...props }: any) {
            return (
              <th
                className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider"
                {...props}
              >
                {children}
              </th>
            );
          },
          td({ node, children, ...props }: any) {
            return (
              <td
                className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700"
                {...props}
              >
                {children}
              </td>
            );
          },
          // Custom blockquote rendering
          blockquote({ node, children, ...props }: any) {
            return (
              <blockquote
                className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-4 text-gray-700 dark:text-gray-300"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          // Custom list rendering
          ul({ node, children, ...props }: any) {
            return (
              <ul className="list-disc list-inside my-2 space-y-1" {...props}>
                {children}
              </ul>
            );
          },
          ol({ node, children, ...props }: any) {
            return (
              <ol className="list-decimal list-inside my-2 space-y-1" {...props}>
                {children}
              </ol>
            );
          },
          // Custom heading rendering
          h1({ node, children, ...props }: any) {
            return (
              <h1 className="text-2xl font-bold mt-4 mb-2" {...props}>
                {children}
              </h1>
            );
          },
          h2({ node, children, ...props }: any) {
            return (
              <h2 className="text-xl font-semibold mt-4 mb-2" {...props}>
                {children}
              </h2>
            );
          },
          h3({ node, children, ...props }: any) {
            return (
              <h3 className="text-lg font-semibold mt-3 mb-2" {...props}>
                {children}
              </h3>
            );
          },
          // Custom paragraph rendering
          p({ node, children, ...props }: any) {
            return (
              <p className="my-2 leading-relaxed" {...props}>
                {children}
              </p>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
