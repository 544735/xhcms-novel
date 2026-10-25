'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* 折线 / 面积趋势图（手写 SVG，零依赖）                                 */
/* ------------------------------------------------------------------ */

export interface TrendPoint {
  label: string;
  value: number;
}

export function TrendChart({
  data,
  height = 200,
  color = '#6366f1',
  className,
  valueSuffix = '',
}: {
  data: TrendPoint[];
  height?: number;
  color?: string;
  className?: string;
  valueSuffix?: string;
}) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const width = 640;
  const padding = { top: 16, right: 16, bottom: 26, left: 36 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  if (!data.length) {
    return (
      <div className={cn('flex h-40 items-center justify-center text-sm text-muted-foreground', className)}>
        暂无趋势数据
      </div>
    );
  }

  const max = Math.max(...data.map((point) => point.value), 1);
  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : innerWidth;
  const points = data.map((point, index) => ({
    x: padding.left + index * stepX,
    y: padding.top + innerHeight - (point.value / max) * innerHeight,
    ...point,
  }));
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${padding.top + innerHeight} L${points[0].x.toFixed(1)},${padding.top + innerHeight} Z`;
  const gradientId = React.useId();

  return (
    <div className={cn('relative w-full', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="趋势图">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + innerHeight * ratio;
          return (
            <line
              key={ratio}
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="currentColor"
              className="text-border"
              strokeDasharray={ratio === 1 ? '0' : '3 5'}
              strokeWidth={1}
            />
          );
        })}
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={point.label}>
            <circle
              cx={point.x}
              cy={point.y}
              r={hovered === index ? 5 : 3.2}
              fill="white"
              stroke={color}
              strokeWidth={2}
              className="transition-all"
            />
            <rect
              x={point.x - stepX / 2}
              y={padding.top}
              width={stepX}
              height={innerHeight}
              fill="transparent"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            />
          </g>
        ))}
        {points.map((point, index) =>
          index % Math.ceil(points.length / 7) === 0 ? (
            <text
              key={`label-${point.label}`}
              x={point.x}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {point.label}
            </text>
          ) : null,
        )}
        {hovered !== null && points[hovered] ? (
          <g>
            <rect
              x={Math.min(Math.max(points[hovered].x - 46, 2), width - 96)}
              y={Math.max(points[hovered].y - 38, 2)}
              width={94}
              height={28}
              rx={7}
              fill="hsl(var(--popover))"
              stroke="hsl(var(--border))"
            />
            <text
              x={Math.min(Math.max(points[hovered].x, 48), width - 48)}
              y={Math.max(points[hovered].y - 19, 21)}
              textAnchor="middle"
              className="fill-foreground text-[11px] font-medium"
            >
              {points[hovered].label} · {points[hovered].value}
              {valueSuffix}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 横向条形排行                                                         */
/* ------------------------------------------------------------------ */

export function BarList({
  data,
  valueSuffix = '',
  className,
}: {
  data: { label: string; value: number; hint?: string }[];
  valueSuffix?: string;
  className?: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className={cn('space-y-3', className)}>
      {data.map((item, index) => (
        <div key={`${item.label}-${index}`} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-foreground/90">{item.label}</span>
            <span className="shrink-0 font-medium text-muted-foreground">
              {item.value}
              {valueSuffix}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
      {!data.length ? <p className="py-6 text-center text-xs text-muted-foreground">暂无数据</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 环形占比图                                                           */
/* ------------------------------------------------------------------ */

export function DonutChart({
  segments,
  size = 168,
  thickness = 18,
  centerLabel,
  centerValue,
  className,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: React.ReactNode;
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={cn('flex flex-wrap items-center gap-6', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={thickness}
          />
          {total > 0 &&
            segments.map((segment) => {
              const length = (segment.value / total) * circumference;
              const element = (
                <circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              );
              offset += length;
              return element;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-foreground">{centerValue ?? total}</span>
          {centerLabel ? <span className="text-[11px] text-muted-foreground">{centerLabel}</span> : null}
        </div>
      </div>
      <ul className="space-y-2 text-xs">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: segment.color }} />
            <span className="min-w-16 text-foreground/80">{segment.label}</span>
            <span className="font-medium text-foreground">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
