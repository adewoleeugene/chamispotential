'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center gap-3 p-12 rounded-[16px] border border-dashed border-[var(--border-strong)] bg-[rgba(255,255,255,0.02)]',
                className,
            )}
            {...props}
        >
            {icon && (
                <div className="flex items-center justify-center h-14 w-14 rounded-full bg-[rgba(180,104,51,0.10)] text-[var(--brand-icon)]">
                    {icon}
                </div>
            )}
            <div>
                <h3 className="text-[var(--text-md)] font-bold text-[var(--text-primary)]">{title}</h3>
                {description && (
                    <p className="text-[var(--text-sm)] text-[var(--text-muted)] mt-1 max-w-md">{description}</p>
                )}
            </div>
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}
