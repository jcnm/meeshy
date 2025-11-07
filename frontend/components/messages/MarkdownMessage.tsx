'use client';

import React, { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';
import { ExternalLink, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  parseMessageLinks,
  recordTrackingLinkClick,
  generateDeviceFingerprint,
} from '@/lib/utils/link-parser';
import { MermaidDiagram } from '@/components/markdown/MermaidDiagram';

interface MarkdownMessageProps {
  content: string;
  className?: string;
  enableTracking?: boolean;
  onLinkClick?: (url: string, isTracking: boolean) => void;
}

/**
 * Prétraite le contenu du message pour transformer les liens spéciaux m+TOKEN
 * en liens markdown avant le rendu par ReactMarkdown
 */
const preprocessContent = (content: string): string => {
  const parts = parseMessageLinks(content);

  return parts.map(part => {
    // Transformer les liens m+TOKEN en liens markdown
    if (part.type === 'mshy-link' && part.trackingUrl) {
      return `[${part.content}](${part.trackingUrl})`;
    }
    // Transformer les liens de tracking complets en markdown s'ils ne sont pas déjà formatés
    if (part.type === 'tracking-link' && part.trackingUrl && !content.includes(`[`) && !content.includes(`](${part.trackingUrl})`)) {
      // Ne transformer que si le lien n'est pas déjà dans un format markdown
      return part.content;
    }
    // Garder le reste tel quel (texte brut et URLs qui seront gérées par ReactMarkdown)
    return part.content;
  }).join('');
};

/**
 * Component to render message content with GitHub Flavored Markdown support
 * Features:
 * - Full GFM support (tables, task lists, strikethrough, etc.)
 * - Syntax highlighting for code blocks
 * - Auto-detects language from code fences
 * - Dark mode support
 * - Inline code highlighting
 * - Tracking link support (including m+TOKEN format)
 */
export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({
  content,
  className = '',
  enableTracking = true,
  onLinkClick
}) => {
  const { theme, resolvedTheme } = useTheme();
  const isDark = theme === 'dark' || resolvedTheme === 'dark';

  // Prétraiter le contenu pour transformer les liens m+TOKEN
  const preprocessedContent = React.useMemo(() => preprocessContent(content), [content]);

  // Handle link clicks with tracking support
  const handleLinkClick = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      // Parse the link to check if it's a tracking link
      const parsedParts = parseMessageLinks(href);
      const linkPart = parsedParts.find(part => part.type !== 'text');

      if (!linkPart) {
        // Regular link, open in new tab
        return;
      }

      const isTracking = linkPart.type === 'tracking-link' || linkPart.type === 'mshy-link';

      // If it's a tracking link and tracking is enabled
      if (isTracking && enableTracking && linkPart.token) {
        e.preventDefault();

        try {
          const deviceFingerprint = generateDeviceFingerprint();
          const result = await recordTrackingLinkClick(linkPart.token, {
            referrer: document.referrer,
            deviceFingerprint,
          });

          if (result.success && result.originalUrl) {
            const newWindow = window.open(result.originalUrl, '_blank', 'noopener,noreferrer');
            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
              window.location.href = result.originalUrl;
            }
          } else {
            const fallbackUrl = linkPart.type === 'mshy-link' ? linkPart.trackingUrl! : href;
            const newWindow = window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
              window.location.href = fallbackUrl;
            }
          }
        } catch (error) {
          console.error('Error handling tracking link click:', error);
          const fallbackUrl = linkPart.type === 'mshy-link' ? linkPart.trackingUrl! : href;
          const newWindow = window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            window.location.href = fallbackUrl;
          }
        }
      }

      // Call the callback if provided
      if (onLinkClick) {
        const url = linkPart.type === 'tracking-link' || linkPart.type === 'mshy-link' ? linkPart.trackingUrl! : href;
        onLinkClick(url, isTracking);
      }
    },
    [enableTracking, onLinkClick]
  );

  return (
    <div className={cn('markdown-message leading-relaxed', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          // Custom code block rendering with syntax highlighting and Mermaid support
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            // Mermaid diagrams
            if (!inline && language === 'mermaid') {
              return (
                <MermaidDiagram
                  chart={String(children).replace(/\n$/, '')}
                  className="my-4"
                />
              );
            }

            // Syntax highlighted code blocks
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
          // Custom link rendering with tracking support
          a({ node, children, href, ...props }: any) {
            // Parse the URL to check if it's a tracking link
            const parsedParts = parseMessageLinks(href || '');
            const linkPart = parsedParts.find(part => part.type !== 'text');
            const isTracking = linkPart && (linkPart.type === 'tracking-link' || linkPart.type === 'mshy-link');
            const isMshyLink = linkPart && linkPart.type === 'mshy-link';

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => handleLinkClick(e, href || '')}
                className={cn(
                  'inline-flex items-center gap-1 underline transition-colors cursor-pointer',
                  isTracking
                    ? 'text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 decoration-blue-500/30 hover:decoration-blue-500/60'
                    : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
                )}
                {...props}
              >
                {isTracking ? (
                  <Link2 className="h-3 w-3 flex-shrink-0 inline" />
                ) : (
                  <ExternalLink className="h-3 w-3 flex-shrink-0 inline" />
                )}
                {isMshyLink ? (
                  <span className="font-mono text-xs">{children}</span>
                ) : (
                  children
                )}
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
        {preprocessedContent}
      </ReactMarkdown>
    </div>
  );
};
