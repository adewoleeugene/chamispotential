'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
    label: string;
    value: string | number;
    icon?: React.ReactNode;
    accent?: 'brand' | 'success' | 'warning' | 'danger' | 'info';
    trend?: { value: string; positive?: boolean };
}

const accentColors: Record<NonNullable<StatProps['accent']>, string> = {
    brand:   'rgba(180,104,51,0.16)',
    success: 'rgba(83,211,167,0.14)',
    warning: 'rgba(245,177,93,0.14)',
    danger:  'rgba(240,107,100,0.14)',
    info:    'rgba(112,174,231,0.14)',
};

const accentForegrounds: Record<NonNullable<StatProps['accent']>, string> = {
    brand:   'var(--brand-icon)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger:  'var(--danger)',
    info:    'var(--info)',
};

export function Stat({ label, value, icon, accent = 'brand', trend, className, ...props }: StatProps) {
    return (
        <div
            className={cn('rounded-[16px] bg-[var(--bg-card)] border border-[var(--border)] p-6', className)}
            {...props}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="text-[var(--text-xs)] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
                {icon && (
                    <div
                        className="flex items-center justify-center h-10 w-10 rounded-[12px]"
                        style={{ background: accentColors[accent], color: accentForegrounds[accent] }}
                    >
                        {icon}
                    </div>
                )}
            </div>
            <div className="text-[var(--text-2xl)] font-extrabold text-[var(--text-primary)]">{value}</div>
            {trend && (
                <div
                    className="text-[var(--text-xs)] font-semibold mt-2"
                    style={{ color: trend.positive ? 'var(--success)' : 'var(--text-muted)' }}
                >
                    {trend.value}
                </div>
            )}
        </div>
    );
}
