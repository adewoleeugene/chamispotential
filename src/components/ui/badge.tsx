'use client';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[var(--text-xs)] font-bold uppercase tracking-wider whitespace-nowrap',
    {
        variants: {
            variant: {
                neutral: 'bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] border border-[var(--border)]',
                brand:   'bg-[rgba(180,104,51,0.16)] text-[var(--text-accent)] border border-[rgba(180,104,51,0.32)]',
                success: 'bg-[rgba(83,211,167,0.14)] text-[var(--success)] border border-[rgba(83,211,167,0.28)]',
                warning: 'bg-[rgba(245,177,93,0.14)] text-[var(--warning)] border border-[rgba(245,177,93,0.28)]',
                danger:  'bg-[rgba(240,107,100,0.14)] text-[var(--danger)] border border-[rgba(240,107,100,0.28)]',
                info:    'bg-[rgba(112,174,231,0.14)] text-[var(--info)] border border-[rgba(112,174,231,0.28)]',
            },
        },
        defaultVariants: { variant: 'neutral' },
    },
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLSpanElement>,
        VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
    return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
