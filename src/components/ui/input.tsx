'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                ref={ref}
                style={{ paddingLeft: 24, paddingRight: 24 }}
                className={cn(
                    'flex h-[var(--size-tap-min)] w-full rounded-[16px] bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand-500)] focus:ring-[3px] focus:ring-[rgba(249,115,22,0.1)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
                    className,
                )}
                {...props}
            />
        );
    },
);
Input.displayName = 'Input';
