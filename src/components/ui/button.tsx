'use client';
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:opacity-50 disabled:cursor-not-allowed select-none',
    {
        variants: {
            variant: {
                primary:
                    'bg-[image:var(--gradient-brand)] text-[#fffaf4] shadow-[var(--shadow-brand)] hover:-translate-y-[1px] hover:shadow-[0_20px_40px_rgba(180,104,51,0.28)]',
                secondary:
                    'bg-[rgba(255,255,255,0.05)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)]',
                ghost:
                    'bg-transparent text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.05)]',
                danger:
                    'bg-[rgba(239,68,68,0.15)] text-[#ef4444] border border-[rgba(239,68,68,0.2)] hover:bg-[rgba(239,68,68,0.25)]',
                success:
                    'bg-[rgba(16,185,129,0.15)] text-[#10b981] border border-[rgba(16,185,129,0.2)] hover:bg-[rgba(16,185,129,0.25)]',
                outline:
                    'bg-transparent text-[var(--text-primary)] border border-[var(--border-strong)] hover:bg-[rgba(255,255,255,0.05)]',
            },
            size: {
                sm:   'min-h-[36px] text-[var(--text-sm)] rounded-[10px]',
                md:   'min-h-[var(--size-tap-min)] text-[var(--text-base)]',
                lg:   'min-h-[var(--size-tap-comfortable)] text-[var(--text-md)]',
                icon: 'min-h-[var(--size-tap-min)] min-w-[var(--size-tap-min)]',
            },
        },
        defaultVariants: { variant: 'primary', size: 'md' },
    },
);

const sizePadding: Record<NonNullable<VariantProps<typeof buttonVariants>['size']>, React.CSSProperties> = {
    sm:   { paddingLeft: 14, paddingRight: 14, paddingTop: 6,  paddingBottom: 6 },
    md:   { paddingLeft: 22, paddingRight: 22, paddingTop: 10, paddingBottom: 10 },
    lg:   { paddingLeft: 28, paddingRight: 28, paddingTop: 12, paddingBottom: 12 },
    icon: { padding: 10 },
};

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size = 'md', asChild = false, style, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        return (
            <Comp
                ref={ref}
                style={{ ...sizePadding[size ?? 'md'], ...style }}
                className={cn(buttonVariants({ variant, size, className }))}
                {...props}
            />
        );
    },
);
Button.displayName = 'Button';

export { buttonVariants };
