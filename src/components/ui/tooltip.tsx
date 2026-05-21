'use client';
import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
    React.ElementRef<typeof TooltipPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
    <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
            ref={ref}
            sideOffset={sideOffset}
            className={cn(
                'z-50 rounded-[8px] border border-[var(--border-strong)] bg-[var(--bg-card)] px-3 py-1.5 text-[var(--text-xs)] font-bold text-[var(--text-accent)] shadow-[var(--shadow-lg)] animate-in fade-in-0 zoom-in-95',
                className,
            )}
            {...props}
        />
    </TooltipPrimitive.Portal>
));
TooltipContent.displayName = 'TooltipContent';

/** Convenience wrapper for the common case: <IconHint label="Edit">{children}</IconHint> */
export function IconHint({
    label,
    children,
    side = 'top',
}: {
    label: string;
    children: React.ReactNode;
    side?: 'top' | 'right' | 'bottom' | 'left';
}) {
    return (
        <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side={side}>{label}</TooltipContent>
        </Tooltip>
    );
}
