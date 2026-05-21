'use client';
import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
    React.ElementRef<typeof SelectPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
    <SelectPrimitive.Trigger
        ref={ref}
        style={{ paddingLeft: 18, paddingRight: 16 }}
        className={cn(
            'flex h-[var(--size-tap-min)] w-full items-center justify-between rounded-[16px] border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand-500)] focus:ring-[3px] focus:ring-[rgba(249,115,22,0.1)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
            className,
        )}
        {...props}
    >
        {children}
        <SelectPrimitive.Icon asChild>
            <ChevronDown size={16} className="opacity-60" />
        </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = React.forwardRef<
    React.ElementRef<typeof SelectPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
    <SelectPrimitive.Portal>
        <SelectPrimitive.Content
            ref={ref}
            className={cn(
                'relative z-50 overflow-hidden rounded-[14px] border border-[var(--border-strong)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)] data-[state=open]:animate-in data-[state=closed]:animate-out',
                position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
                className,
            )}
            position={position}
            {...props}
        >
            <SelectPrimitive.Viewport className="p-1.5 min-w-[var(--radix-select-trigger-width)]">
                {children}
            </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectItem = React.forwardRef<
    React.ElementRef<typeof SelectPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
    <SelectPrimitive.Item
        ref={ref}
        className={cn(
            'relative flex w-full cursor-pointer items-center rounded-[10px] py-2 pl-8 pr-3 text-[var(--text-sm)] text-[var(--text-primary)] outline-none focus:bg-[rgba(255,255,255,0.06)] data-[disabled]:opacity-50 data-[disabled]:pointer-events-none',
            className,
        )}
        {...props}
    >
        <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
            <SelectPrimitive.ItemIndicator>
                <Check size={14} className="text-[var(--brand-icon)]" />
            </SelectPrimitive.ItemIndicator>
        </span>
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';
