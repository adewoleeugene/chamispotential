'use client';
import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
    label?: string;
    htmlFor?: string;
    description?: string;
    error?: string;
    required?: boolean;
    className?: string;
    children: React.ReactNode;
}

export function FormField({ label, htmlFor, description, error, required, className, children }: FormFieldProps) {
    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            {label && (
                <Label htmlFor={htmlFor}>
                    {label}
                    {required && <span className="text-[var(--danger)] ml-1">*</span>}
                </Label>
            )}
            {children}
            {description && !error && (
                <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">{description}</p>
            )}
            {error && (
                <p className="text-[var(--text-xs)] text-[var(--danger)] mt-1">{error}</p>
            )}
        </div>
    );
}
