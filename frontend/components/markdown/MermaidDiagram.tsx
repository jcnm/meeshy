'use client';

import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

// Configuration globale de Mermaid
let mermaidInitialized = false;

const initializeMermaid = () => {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      themeVariables: {
        primaryColor: '#a855f7',
        primaryTextColor: '#fff',
        primaryBorderColor: '#9333ea',
        lineColor: '#6b7280',
        secondaryColor: '#ec4899',
        tertiaryColor: '#3b82f6',
      },
    });
    mermaidInitialized = true;
  }
};

/**
 * Composant pour afficher les diagrammes Mermaid dans les messages markdown
 */
export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  chart,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    if (!chart || !containerRef.current) return;

    const renderDiagram = async () => {
      try {
        initializeMermaid();

        // Générer un ID unique pour ce diagramme
        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;

        // Rendre le diagramme
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        setSvg(renderedSvg);
        setError(null);
      } catch (err: any) {
        console.error('Erreur lors du rendu du diagramme Mermaid:', err);
        setError(err?.message || 'Erreur lors du rendu du diagramme');
      }
    };

    renderDiagram();
  }, [chart]);

  if (error) {
    return (
      <div
        className={`p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg ${className}`}
      >
        <p className="text-sm text-red-600 dark:text-red-400 font-semibold mb-2">
          Erreur de diagramme Mermaid
        </p>
        <p className="text-xs text-red-500 dark:text-red-300 font-mono">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-diagram overflow-x-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
