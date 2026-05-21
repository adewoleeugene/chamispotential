'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    actions?: React.ReactNode;
}

export function PageHeader({ icon, title, description, actions, className, ...props }: PageHeaderProps) {
    return (
        <div className={cn('flex flex-wrap items-start justify-between gap-4 mb-6', className)} {...props}>
            <div className="flex items-start gap-3">
                {icon && (
                    <div className="flex items-center justify-center h-10 w-10 rounded-[12px] bg-[rgba(180,104,51,0.12)] text-[var(--brand-icon)] flex-shrink-0">
                        {icon}
                    </div>
                )}
                <div>
                    <h2 className="text-[var(--text-md)] font-bold text-[var(--text-primary)]">{title}</h2>
                    {description && (
                        <p className="text-[var(--text-sm)] text-[var(--text-muted)] mt-1">{description}</p>
                    )}
                </div>
            </div>
            {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </div>
    );
}
