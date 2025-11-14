'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
  iconClassName?: string;
  loading?: boolean;
}

/**
 * Carte de métrique moderne avec indicateur de tendance
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
  iconClassName,
  loading = false,
}) => {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUp className="h-3 w-3" />;
    if (trend.value < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.value > 0) return 'text-green-600 dark:text-green-400';
    if (trend.value < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </CardTitle>
          <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('hover:shadow-lg transition-shadow duration-200', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <Icon className={cn('h-4 w-4 text-muted-foreground', iconClassName)} />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || trend) && (
          <div className="flex items-center gap-2 mt-1">
            {trend && (
              <div className={cn('flex items-center gap-1 text-xs font-medium', getTrendColor())}>
                {getTrendIcon()}
                <span>{Math.abs(trend.value)}%</span>
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">
                {trend && '• '}{description}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Carte de métrique avec graphique sparkline inline
 */
interface MetricCardWithSparklineProps extends MetricCardProps {
  sparklineData?: number[];
  sparklineColor?: string;
}

export const MetricCardWithSparkline: React.FC<MetricCardWithSparklineProps> = ({
  sparklineData = [],
  sparklineColor = '#3b82f6',
  ...props
}) => {
  return (
    <div className="relative">
      <MetricCard {...props} />
      {sparklineData.length > 0 && (
        <div className="absolute bottom-0 right-0 left-0 h-12 opacity-20 pointer-events-none">
          <svg width="100%" height="100%" className="overflow-visible">
            <polyline
              fill="none"
              stroke={sparklineColor}
              strokeWidth="2"
              points={sparklineData
                .map((val, i) => {
                  const x = (i / (sparklineData.length - 1)) * 100;
                  const y = 100 - (val / Math.max(...sparklineData)) * 100;
                  return `${x},${y}`;
                })
                .join(' ')}
            />
          </svg>
        </div>
      )}
    </div>
  );
};
