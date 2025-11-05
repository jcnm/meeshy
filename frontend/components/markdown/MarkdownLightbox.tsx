'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Eye, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import type { UploadedAttachmentResponse } from '@/shared/types/attachment';

interface MarkdownLightboxProps {
  attachment: UploadedAttachmentResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Markdown Lightbox - Fullscreen Markdown viewer matching ImageLightbox pattern
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

  // Fetch content when opening
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

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Simple markdown to HTML conversion
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

  if (!isOpen || !attachment) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/95 dark:bg-black/98 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Header bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex flex-col text-white min-w-0 flex-1 mr-4">
            <span className="font-medium text-xs sm:text-sm md:text-base truncate">
              {attachment.originalName}
            </span>
            <span className="text-[10px] sm:text-xs text-gray-300">
              Markdown Document
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Toggle raw/formatted view */}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                toggleRawMode();
              }}
              className="text-white hover:bg-white/10 w-8 h-8 sm:w-10 sm:h-10"
              title={showRaw ? 'Vue formatée' : 'Vue brute'}
              disabled={isLoading || hasError}
            >
              {showRaw ? (
                <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Code className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                const link = document.createElement('a');
                link.href = attachment.fileUrl;
                link.download = attachment.originalName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="text-white hover:bg-white/10 w-8 h-8 sm:w-10 sm:h-10"
              aria-label="Télécharger le fichier Markdown"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-white hover:bg-white/10 w-8 h-8 sm:w-10 sm:h-10"
              aria-label="Fermer"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>

        {/* Markdown Viewer */}
        <div
          className="absolute inset-0 flex items-center justify-center pt-14 sm:pt-16 pb-2 sm:pb-4 px-2 sm:px-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full h-full bg-white dark:bg-gray-900 overflow-hidden shadow-2xl">
            <div className="w-full h-full overflow-auto p-4 sm:p-6 md:p-8">
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
          </div>
        </div>

        {/* Instructions (desktop only) */}
        <div className="hidden md:block absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs text-center">
          <p>Appuyez sur Échap pour fermer</p>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
