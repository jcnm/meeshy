'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  WrapText,
  FileText,
  Eye,
  Code,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Attachment } from '@/shared/types/attachment';
import { formatFileSize } from '@/shared/types/attachment';
import { detectMarkdown, getMarkdownConfidence } from '@/lib/utils/markdown';
import { MarkdownContent } from '@/components/markdown/MarkdownContent';
import { toast } from 'sonner';

interface TextLightboxProps {
  textFiles: Attachment[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Lightbox plein écran pour fichiers texte avec support markdown
 * - Navigation multi-fichiers
 * - Markdown formatting (auto-enabled if detected)
 * - Copy to clipboard
 * - Word wrap toggle
 * - Keyboard shortcuts
 */
export const TextLightbox: React.FC<TextLightboxProps> = ({
  textFiles,
  initialIndex = 0,
  isOpen,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [hasMarkdown, setHasMarkdown] = useState(false);
  const [markdownConfidence, setMarkdownConfidence] = useState(0);
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const currentFile = textFiles[currentIndex];

  // Load content when file changes
  useEffect(() => {
    if (!isOpen || !currentFile) return;

    const loadContent = async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        const response = await fetch(currentFile.fileUrl);
        if (!response.ok) {
          throw new Error('Erreur de chargement');
        }

        const text = await response.text();
        setContent(text);

        // Detect markdown
        const hasMarkdownSyntax = detectMarkdown(text);
        const confidence = getMarkdownConfidence(text);
        setHasMarkdown(hasMarkdownSyntax);
        setMarkdownConfidence(confidence);

        // Auto-enable markdown if detected with high confidence
        setShowMarkdown(hasMarkdownSyntax && confidence >= 30);
      } catch (error) {
        console.error('Erreur chargement fichier:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [currentFile, isOpen]);

  // Reset index when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  const goToPrevFile = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : textFiles.length - 1));
  }, [textFiles.length]);

  const goToNextFile = useCallback(() => {
    setCurrentIndex((prev) => (prev < textFiles.length - 1 ? prev + 1 : 0));
  }, [textFiles.length]);

  const toggleMarkdown = () => {
    setShowMarkdown((prev) => !prev);
  };

  const toggleWordWrap = () => {
    setWordWrap((prev) => !prev);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      toast.success('Copié dans le presse-papiers');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Erreur copie:', error);
      toast.error('Impossible de copier');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (textFiles.length > 1) {
            goToPrevFile();
          }
          break;
        case 'ArrowRight':
          if (textFiles.length > 1) {
            goToNextFile();
          }
          break;
        case 'c':
        case 'C':
          if (e.ctrlKey || e.metaKey) {
            // Let browser handle Ctrl+C
            break;
          }
          handleCopy();
          break;
        case 'm':
        case 'M':
          if (hasMarkdown) {
            toggleMarkdown();
          }
          break;
        case 'w':
        case 'W':
          toggleWordWrap();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goToPrevFile, goToNextFile, hasMarkdown, textFiles.length]);

  if (!isOpen || !currentFile) return null;

  const getFileExtension = () => {
    const parts = currentFile.originalName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'TXT';
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
        onClick={onClose}
      >
        {/* Top toolbar */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <FileText className="w-5 h-5 text-white flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <h3 className="text-white font-medium text-sm truncate">
                {currentFile.originalName}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{formatFileSize(currentFile.fileSize)}</span>
                <span>•</span>
                <span>{getFileExtension()}</span>
                {content && (
                  <>
                    <span>•</span>
                    <span>{content.split('\n').length} lignes</span>
                  </>
                )}
                {hasMarkdown && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-blue-400">
                      <Sparkles className="w-3 h-3" />
                      Markdown ({markdownConfidence}%)
                    </span>
                  </>
                )}
                {textFiles.length > 1 && (
                  <>
                    <span>•</span>
                    <span>
                      Fichier {currentIndex + 1}/{textFiles.length}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download */}
            <a
              href={currentFile.fileUrl}
              download={currentFile.originalName}
              onClick={(e) => e.stopPropagation()}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <Download className="w-5 h-5 text-white" />
            </a>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content display area */}
        <div
          className="flex-1 overflow-auto p-4"
          onClick={(e) => e.stopPropagation()}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : hasError ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-white">
              <FileText className="w-16 h-16 opacity-50" />
              <span>Erreur de chargement</span>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
              {showMarkdown && hasMarkdown ? (
                <div className="p-6 text-white">
                  <MarkdownContent content={content} className="prose-invert" />
                </div>
              ) : (
                <pre
                  className={`p-6 text-sm text-white font-mono overflow-x-auto ${
                    wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                  }`}
                >
                  {content}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div
          className="flex flex-col gap-2 px-4 py-3 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* File navigation (if multiple files) */}
          {textFiles.length > 1 && (
            <div className="flex items-center justify-center gap-2 pb-2 border-b border-white/10">
              <Button
                onClick={goToPrevFile}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Fichier précédent
              </Button>

              <span className="text-white text-sm px-4">
                {currentIndex + 1} / {textFiles.length}
              </span>

              <Button
                onClick={goToNextFile}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
              >
                Fichier suivant
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Main controls */}
          <div className="flex items-center justify-between gap-4">
            {/* View controls */}
            <div className="flex items-center gap-2">
              {hasMarkdown && (
                <Button
                  onClick={toggleMarkdown}
                  variant="ghost"
                  size="sm"
                  className={`text-white hover:bg-white/10 ${
                    showMarkdown ? 'bg-white/20' : ''
                  }`}
                  title={showMarkdown ? 'Vue brute (M)' : 'Vue formatée (M)'}
                >
                  {showMarkdown ? (
                    <>
                      <Code className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Brut</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Formaté</span>
                    </>
                  )}
                </Button>
              )}

              <Button
                onClick={toggleWordWrap}
                variant="ghost"
                size="sm"
                className={`text-white hover:bg-white/10 ${
                  wordWrap ? 'bg-white/20' : ''
                }`}
                title={wordWrap ? 'Désactiver le retour (W)' : 'Retour à la ligne (W)'}
              >
                <WrapText className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Wrap</span>
              </Button>

              <Button
                onClick={handleCopy}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                title="Copier (C)"
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4 mr-1 text-green-400" />
                    <span className="hidden sm:inline text-green-400">Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Copier</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="text-center text-xs text-gray-400 pt-2 border-t border-white/10">
            <span className="hidden sm:inline">
              Raccourcis: ← → (fichiers) • M (markdown) • W (wrap) • C (copier) • Esc (fermer)
            </span>
            <span className="sm:hidden">Appuyez sur Esc pour fermer</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
