'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface HeatmapDataPoint {
  x: string;
  y: string;
  value: number;
}

interface HeatmapChartProps {
  data: HeatmapDataPoint[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  colorScale?: {
    low: string;
    medium: string;
    high: string;
  };
  loading?: boolean;
}

const DEFAULT_COLOR_SCALE = {
  low: '#dbeafe', // blue-100
  medium: '#3b82f6', // blue-500
  high: '#1e3a8a', // blue-900
};

/**
 * Heatmap pour visualiser l'activité (ex: par heure/jour)
 */
export const HeatmapChart: React.FC<HeatmapChartProps> = ({
  data,
  title,
  xLabel,
  yLabel,
  colorScale = DEFAULT_COLOR_SCALE,
  loading = false,
}) => {
  // Extraire les valeurs uniques pour X et Y
  const xValues = Array.from(new Set(data.map((d) => d.x))).sort();
  const yValues = Array.from(new Set(data.map((d) => d.y))).sort();

  // Trouver min/max pour la normalisation
  const values = data.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  const getColor = (value: number) => {
    if (maxValue === minValue) return colorScale.medium;

    const normalized = (value - minValue) / (maxValue - minValue);

    if (normalized < 0.33) return colorScale.low;
    if (normalized < 0.66) return colorScale.medium;
    return colorScale.high;
  };

  const getValue = (x: string, y: string) => {
    const point = data.find((d) => d.x === x && d.y === y);
    return point?.value ?? 0;
  };

  if (loading) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Y Label */}
            <div className="flex">
              {yLabel && (
                <div className="w-12 flex items-center justify-center">
                  <span className="text-xs font-medium text-muted-foreground transform -rotate-90">
                    {yLabel}
                  </span>
                </div>
              )}
              <div className="flex-1">
                {/* Heatmap Grid */}
                <div className="space-y-1">
                  {yValues.map((y) => (
                    <div key={y} className="flex items-center gap-1">
                      <div className="w-16 text-xs text-right text-muted-foreground pr-2">
                        {y}
                      </div>
                      <div className="flex gap-1">
                        {xValues.map((x) => {
                          const value = getValue(x, y);
                          return (
                            <div
                              key={`${x}-${y}`}
                              className={cn(
                                'w-8 h-8 rounded flex items-center justify-center text-xs font-medium transition-colors cursor-pointer hover:opacity-80',
                                value === 0 ? 'bg-gray-100 dark:bg-gray-800 text-gray-400' : 'text-white'
                              )}
                              style={{
                                backgroundColor: value > 0 ? getColor(value) : undefined,
                              }}
                              title={`${x} - ${y}: ${value}`}
                            >
                              {value > 0 ? value : ''}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {/* X Labels */}
                {xLabel && (
                  <div className="mt-2 flex">
                    <div className="w-16" />
                    <div className="flex gap-1">
                      {xValues.map((x) => (
                        <div key={x} className="w-8 text-xs text-center text-muted-foreground">
                          {x}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {xLabel && (
                  <div className="mt-1 text-center">
                    <span className="text-xs font-medium text-muted-foreground">{xLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-4">
          <span className="text-xs text-muted-foreground">Faible</span>
          <div className="flex gap-1">
            <div className="w-6 h-4 rounded" style={{ backgroundColor: colorScale.low }} />
            <div className="w-6 h-4 rounded" style={{ backgroundColor: colorScale.medium }} />
            <div className="w-6 h-4 rounded" style={{ backgroundColor: colorScale.high }} />
          </div>
          <span className="text-xs text-muted-foreground">Élevé</span>
        </div>
      </CardContent>
    </Card>
  );
};
