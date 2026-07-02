import { LabelHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, ...props },
  ref,
) {
  return (
    <label
      ref={ref}
      className={cn('mb-1 block text-sm font-medium text-slate-700', className)}
      {...props}
    />
  );
});
