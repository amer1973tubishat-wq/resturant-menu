'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------- Button
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 active:scale-[.98]',
  {
    variants: {
      variant: {
        primary: 'bg-flame text-[#160A02] hover:bg-flame-deep shadow-sm',
        danger: 'bg-jo-red text-white hover:bg-jo-hi shadow-sm',
        outline: 'border border-line bg-transparent hover:bg-surface2 text-ink',
        ghost: 'hover:bg-surface2 text-ink',
        subtle: 'bg-surface2 text-ink hover:bg-line/40',
      },
      size: { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4', lg: 'h-11 px-6', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

// ---------------------------------------------------------------- Input
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink',
        'placeholder:text-muted focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-1',
        'disabled:opacity-60',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-line bg-surface p-3 text-sm text-ink placeholder:text-muted',
        'focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-1',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-xs font-medium text-muted', className)} {...props} />;
}

// ---------------------------------------------------------------- Card
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-line bg-surface', className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between gap-3 border-b border-line px-5 py-3.5', className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-semibold text-ink', className)} {...props} />;
}
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

// ---------------------------------------------------------------- Badge
const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', {
  variants: {
    tone: {
      neutral: 'bg-surface2 text-muted border border-line',
      flame: 'bg-flame/15 text-flame border border-flame/30',
      gold: 'bg-gold/15 text-gold-deep border border-gold/30',
      red: 'bg-jo-red/15 text-jo-red border border-jo-red/30',
      green: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

// ---------------------------------------------------------------- Skeleton
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} aria-hidden />;
}

// ---------------------------------------------------------------- Switch
export function Switch({
  checked, onCheckedChange, label, disabled,
}: { checked: boolean; onCheckedChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-flame' : 'bg-line',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
          checked ? 'start-[18px]' : 'start-0.5',
        )}
      />
    </button>
  );
}
