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
  isOwnMessage?: boolean; // Pour adapter les couleurs en fonction de l'expéditeur
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
 * Normalise le markdown en corrigeant les espaces incorrects introduits par la traduction
 * Corrige les problèmes courants:
 * - `** texte **` → `**texte**` (gras avec espaces)
 * - `* texte *` → `*texte*` (italique avec espaces)
 * - `[ lien ]( url )` → `[lien](url)` (liens avec espaces)
 * - `__ texte __` → `__texte__` (gras alternatif avec espaces)
 * - `_ texte _` → `_texte_` (italique alternatif avec espaces)
 */
const normalizeMarkdown = (content: string): string => {
  let normalized = content;

  // Corriger les gras avec espaces: ** texte ** → **texte**
  normalized = normalized.replace(/\*\*\s+([^*]+?)\s+\*\*/g, '**$1**');

  // Corriger les italiques avec espaces: * texte * → *texte*
  // Mais éviter de toucher aux listes (* item)
  normalized = normalized.replace(/(?<!\n)\*\s+([^*\n]+?)\s+\*/g, '*$1*');

  // Corriger les gras alternatifs avec espaces: __ texte __ → __texte__
  normalized = normalized.replace(/__\s+([^_]+?)\s+__/g, '__$1__');

  // Corriger les italiques alternatifs avec espaces: _ texte _ → _texte_
  normalized = normalized.replace(/(?<!\w)_\s+([^_]+?)\s+_(?!\w)/g, '_$1_');

  // Corriger les liens avec espaces: [ texte ]( url ) → [texte](url)
  normalized = normalized.replace(/\[\s+([^\]]+?)\s+\]\(\s+([^)]+?)\s+\)/g, '[$1]($2)');

  // Corriger les codes inline avec espaces: ` code ` → `code`
  normalized = normalized.replace(/`\s+([^`]+?)\s+`/g, '`$1`');

  return normalized;
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
  onLinkClick,
  isOwnMessage = false
}) => {
  const { theme, resolvedTheme } = useTheme();
  const isDark = theme === 'dark' || resolvedTheme === 'dark';

  // Prétraiter le contenu pour transformer les liens m+TOKEN et normaliser le markdown
  const preprocessedContent = React.useMemo(() => {
    const withLinks = preprocessContent(content);
    return normalizeMarkdown(withLinks);
  }, [content]);

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
          // Custom link rendering with tracking support and mention detection
          a({ node, children, href, ...props }: any) {
            // Check if this is a user mention link (/u/username)
            const isMention = href && href.startsWith('/u/');

            // Parse the URL to check if it's a tracking link
            const parsedParts = parseMessageLinks(href || '');
            const linkPart = parsedParts.find(part => part.type !== 'text');
            const isTracking = linkPart && (linkPart.type === 'tracking-link' || linkPart.type === 'mshy-link');
            const isMshyLink = linkPart && linkPart.type === 'mshy-link';

            // For mentions, use internal routing instead of opening in new tab
            const linkTarget = isMention ? undefined : "_blank";
            const linkRel = isMention ? undefined : "noopener noreferrer";

            return (
              <a
                href={href}
                target={linkTarget}
                rel={linkRel}
                onClick={(e) => !isMention && handleLinkClick(e, href || '')}
                className={cn(
                  'inline-flex items-center gap-1 transition-colors cursor-pointer',
                  isMention
                    ? 'text-purple-400 dark:text-purple-300 no-underline hover:underline font-medium'
                    : 'underline',
                  !isMention && isTracking
                    ? 'text-orange-400 hover:text-orange-500 dark:text-orange-300 dark:hover:text-orange-200 decoration-orange-400/40 hover:decoration-orange-500/60'
                    : !isMention && 'text-orange-400 hover:text-orange-500 dark:text-orange-300 dark:hover:text-orange-200'
                )}
                {...props}
              >
                {!isMention && isTracking ? (
                  <Link2 className="h-3 w-3 flex-shrink-0 inline" />
                ) : !isMention ? (
                  <ExternalLink className="h-3 w-3 flex-shrink-0 inline" />
                ) : null}
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
          // Custom paragraph rendering with whitespace preservation
          p({ node, children, ...props }: any) {
            return (
              <p className="my-2 leading-relaxed whitespace-pre-line" {...props}>
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
