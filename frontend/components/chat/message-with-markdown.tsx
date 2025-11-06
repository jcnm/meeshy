'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MessageWithLinks, MessageWithLinksProps } from './message-with-links';
import { MarkdownContent } from '@/components/markdown/MarkdownContent';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink, Link2 } from 'lucide-react';
import {
  parseMessageLinks,
  recordTrackingLinkClick,
  generateDeviceFingerprint,
} from '@/lib/utils/link-parser';

export interface MessageWithMarkdownProps extends Omit<MessageWithLinksProps, 'className'> {
  /**
   * Enable markdown formatting
   * @default false
   */
  enableMarkdown?: boolean;

  /**
   * Custom className for the wrapper
   */
  className?: string;
}

/**
 * Component to display message with optional markdown formatting and clickable links
 * By default, markdown is disabled to show plain text
 */
export function MessageWithMarkdown({
  content,
  enableMarkdown = false,
  className,
  linkClassName,
  textClassName,
  onLinkClick,
  enableTracking = true,
}: MessageWithMarkdownProps) {
  // If markdown is disabled, use the standard MessageWithLinks
  if (!enableMarkdown) {
    return (
      <MessageWithLinks
        content={content}
        className={className}
        linkClassName={linkClassName}
        textClassName={textClassName}
        onLinkClick={onLinkClick}
        enableTracking={enableTracking}
      />
    );
  }

  // Render with markdown support
  const components: Partial<Components> = {
    // Custom link rendering with tracking support
    a: ({ href, children, ...props }) => {
      // Check if it's a tracking link
      const isTrackingLink = href?.includes('meeshy.me/l/');
      const isMshyLink = href?.startsWith('m+');

      const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (isTrackingLink && enableTracking && href) {
          const tokenMatch = href.match(/\/l\/([^/?]+)/);
          if (tokenMatch) {
            e.preventDefault();
            try {
              const deviceFingerprint = generateDeviceFingerprint();
              const result = await recordTrackingLinkClick(tokenMatch[1], {
                referrer: document.referrer,
                deviceFingerprint,
              });

              if (result.success && result.originalUrl) {
                window.open(result.originalUrl, '_blank', 'noopener,noreferrer');
              } else {
                window.open(href, '_blank', 'noopener,noreferrer');
              }
            } catch (error) {
              window.open(href, '_blank', 'noopener,noreferrer');
            }
          }
        }

        if (onLinkClick && href) {
          onLinkClick(href, isTrackingLink || false);
        }
      };

      return (
        <a
          href={href}
          onClick={handleClick}
          className={cn(
            'inline-flex items-center gap-0.5',
            linkClassName
          )}
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {isTrackingLink || isMshyLink ? (
            <Link2 className="h-3 w-3 flex-shrink-0 inline" />
          ) : (
            <ExternalLink className="h-3 w-3 flex-shrink-0 inline" />
          )}
          {children}
        </a>
      );
    },
  };

  return (
    <div className={cn('text-sm', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1.5',
          'prose-h1:text-xl prose-h2:text-lg prose-h3:text-base',
          'prose-p:my-1',
          'prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:underline hover:prose-a:no-underline',
          'prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs',
          'prose-code:before:content-none prose-code:after:content-none',
          'prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:p-2 prose-pre:rounded prose-pre:overflow-x-auto prose-pre:text-xs',
          'prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5',
          'prose-blockquote:border-l-2 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600 prose-blockquote:pl-3 prose-blockquote:italic',
          'prose-img:rounded prose-img:max-w-full',
          'prose-hr:border-gray-300 dark:prose-hr:border-gray-600 prose-hr:my-2',
          textClassName
        )}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
