'use client';

import {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  createContext,
  useContext,
} from 'react';
import { cn } from '@/lib/utils/cn';

type TabsContextValue = {
  value: string;
  onValueChange?: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

type TabsProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
  onValueChange?: (value: string) => void;
};

export function Tabs({ value, onValueChange, className, ...props }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('w-full', className)} {...props} />
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('inline-flex rounded-md bg-slate-100 p-1 text-sm', className)}
      {...props}
    />
  );
}

type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

export function TabsTrigger({ value, className, ...props }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  const selected = context?.value === value;

  return (
    <button
      type="button"
      className={cn(
        'rounded px-3 py-1.5 font-medium transition-colors',
        selected ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900',
        className,
      )}
      aria-selected={selected}
      onClick={() => context?.onValueChange?.(value)}
      {...props}
    />
  );
}

type TabsContentProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
  children: ReactNode;
};

export function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const context = useContext(TabsContext);
  if (context?.value !== value) return null;

  return (
    <div className={cn('mt-4', className)} {...props}>
      {children}
    </div>
  );
}
