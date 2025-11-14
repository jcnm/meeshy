'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  TooltipProps,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DistributionDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface DistributionChartProps {
  data: DistributionDataPoint[];
  title?: string;
  height?: number;
  innerRadius?: number; // 0 = pie, >0 = donut
  showLegend?: boolean;
  showPercentage?: boolean;
  colors?: string[];
  loading?: boolean;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#10b981', // green
  '#f59e0b', // orange
  '#ef4444', // red
  '#06b6d4', // cyan
  '#6366f1', // indigo
];

/**
 * Graphique de distribution (Pie/Donut) pour afficher des répartitions
 */
export const DistributionChart: React.FC<DistributionChartProps> = ({
  data,
  title,
  height = 300,
  innerRadius = 0,
  showLegend = true,
  showPercentage = true,
  colors = DEFAULT_COLORS,
  loading = false,
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const dataWithColors = data.map((item, index) => ({
    ...item,
    color: item.color || colors[index % colors.length],
  }));

  const CustomTooltip = ({ active, payload }: TooltipProps<any, any>) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm mb-1">{data.name}</p>
          <div className="flex items-center gap-2 text-xs">
            <span>{data.value.toLocaleString()}</span>
            {showPercentage && <span className="text-muted-foreground">({percentage}%)</span>}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = (entry: any) => {
    if (!showPercentage) return null;
    const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0;
    return parseFloat(percentage) > 5 ? `${percentage}%` : '';
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
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded animate-pulse" style={{ height }} />
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
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={dataWithColors}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={height / 3}
              innerRadius={innerRadius}
              fill="#8884d8"
              dataKey="value"
            >
              {dataWithColors.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

/**
 * Variante Donut (avec innerRadius par défaut)
 */
export const DonutChart: React.FC<Omit<DistributionChartProps, 'innerRadius'>> = (props) => {
  return <DistributionChart {...props} innerRadius={60} />;
};
