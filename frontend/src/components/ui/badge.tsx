import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'gray' | 'green' | 'red' | 'yellow' | 'blue' | 'purple';

const variants: Record<Variant, string> = {
  gray: 'bg-slate-100 text-slate-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
};

export function Badge({
  children,
  variant = 'gray',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function statusVariant(status: string): Variant {
  const s = status.toUpperCase();
  if (['ACTIVE', 'PAID', 'POSTED', 'AVAILABLE', 'SUCCESS'].includes(s)) return 'green';
  if (['DRAFT', 'PENDING', 'IN_TRANSIT', 'RESERVED'].includes(s)) return 'yellow';
  if (['VOIDED', 'CANCELLED', 'EXPIRED', 'SUSPENDED', 'DAMAGED', 'BLOCKED'].includes(s)) return 'red';
  if (['PARTIALLY_PAID', 'CREDIT_OPEN'].includes(s)) return 'blue';
  return 'gray';
}
