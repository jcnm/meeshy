/**
 * Markdown utilities for parsing and rendering markdown content
 */

/**
 * Detect if text content contains markdown syntax
 */
export function detectMarkdown(text: string): boolean {
  if (!text || text.length < 3) return false;

  const markdownPatterns = [
    // Headers
    /^#{1,6}\s+.+$/m,
    // Bold
    /\*\*[^*]+\*\*/,
    /__[^_]+__/,
    // Italic
    /\*[^*]+\*/,
    /_[^_]+_/,
    // Links
    /\[.+\]\(.+\)/,
    // Images
    /!\[.*\]\(.+\)/,
    // Code blocks
    /```[\s\S]*```/,
    // Inline code
    /`[^`]+`/,
    // Lists
    /^[\s]*[-*+]\s+.+$/m,
    /^\d+\.\s+.+$/m,
    // Blockquotes
    /^>\s+.+$/m,
    // Horizontal rules
    /^[-*_]{3,}$/m,
    // Tables
    /\|.+\|/,
  ];

  // Check if at least 2 different markdown patterns are found
  let matchCount = 0;
  for (const pattern of markdownPatterns) {
    if (pattern.test(text)) {
      matchCount++;
      if (matchCount >= 2) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate markdown confidence score (0-100)
 * Higher score = more likely to be markdown
 */
export function getMarkdownConfidence(text: string): number {
  if (!text || text.length < 10) return 0;

  let score = 0;
  const lines = text.split('\n');

  // Check for headers
  const headerLines = lines.filter(line => /^#{1,6}\s+.+$/.test(line));
  score += Math.min(headerLines.length * 10, 30);

  // Check for lists
  const listLines = lines.filter(line => /^[\s]*[-*+]\s+.+$/.test(line) || /^\d+\.\s+.+$/.test(line));
  score += Math.min(listLines.length * 5, 20);

  // Check for code blocks
  const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).length;
  score += Math.min(codeBlocks * 15, 30);

  // Check for emphasis
  const boldMatches = (text.match(/(\*\*[^*]+\*\*|__[^_]+__)/g) || []).length;
  const italicMatches = (text.match(/(\*[^*]+\*|_[^_]+_)/g) || []).length;
  score += Math.min((boldMatches + italicMatches) * 2, 10);

  // Check for links
  const linkMatches = (text.match(/\[.+\]\(.+\)/g) || []).length;
  score += Math.min(linkMatches * 5, 10);

  return Math.min(score, 100);
}

/**
 * File extensions that are commonly markdown
 */
export const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn'];

/**
 * Check if filename suggests markdown content
 */
export function isMarkdownFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return MARKDOWN_EXTENSIONS.some(ext => lower.endsWith(ext));
}
