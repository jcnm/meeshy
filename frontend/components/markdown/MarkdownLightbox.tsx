'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { X, Download, Eye, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UploadedAttachmentResponse } from '@/shared/types/attachment';

interface MarkdownLightboxProps {
  attachment: UploadedAttachmentResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Markdown Lightbox - Full screen Markdown viewer
 */
export const MarkdownLightbox: React.FC<MarkdownLightboxProps> = ({
  attachment,
  isOpen,
  onClose
}) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!attachment || !isOpen) return;

    const fetchContent = async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        const response = await fetch(attachment.fileUrl);
        if (!response.ok) {
          throw new Error('Erreur de chargement');
        }

        const text = await response.text();
        setContent(text);
      } catch (error) {
        console.error('Erreur chargement markdown:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [attachment, isOpen]);

  // Simple markdown to HTML conversion (same as inline viewer)
  const renderMarkdown = (md: string): string => {
    let html = md;

    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto my-4"><code>$2</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">$1</code>');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');

    // Lists
    html = html.replace(/^\* (.*$)/gim, '<li class="ml-4">$1</li>');
    html = html.replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>');

    // Line breaks
    html = html.replace(/\n/g, '<br/>');

    return html;
  };

  const toggleRawMode = () => {
    setShowRaw(!showRaw);
  };

  if (!attachment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-7xl w-full h-[90vh] p-0 gap-0">
        <DialogTitle className="sr-only">{attachment.originalName}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <h3 className="text-lg font-semibold truncate">{attachment.originalName}</h3>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Toggle raw/formatted view */}
            <Button
              onClick={toggleRawMode}
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0"
              title={showRaw ? 'Vue formatée' : 'Vue brute'}
              disabled={isLoading || hasError}
            >
              {showRaw ? (
                <Eye className="w-5 h-5" />
              ) : (
                <Code className="w-5 h-5" />
              )}
            </Button>

            {/* Download button */}
            <a
              href={attachment.fileUrl}
              download={attachment.originalName}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              title="Télécharger"
            >
              <Download className="w-5 h-5" />
            </a>

            {/* Close button */}
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Markdown Viewer */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : hasError ? (
            <div className="flex items-center justify-center h-full text-gray-600 dark:text-gray-400">
              <span>Impossible de charger le fichier</span>
            </div>
          ) : showRaw ? (
            <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
              {content}
            </pre>
          ) : (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
